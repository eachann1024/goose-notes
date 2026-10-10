import type { StoreSet, StoreGet } from "../../hydrate";
import type { JSONContent } from "@/types";
import { localPageHasPersistableContent } from "@/lib/unsavedLocalPage";
import {
  assignUnsavedLocalFilePathAction,
  cloneLocalPageContent,
} from "../../pageCreate";
import { findDuplicateLocalFileOwner } from "../pathGuards";
import { collectLocalImageWrites } from "./images";
import { encodeLocalBlockPropsWrappers } from "@/lib/export/markdown/blockPropsMarker";
import {
  mergeSettingsIntoFrontmatterHeader,
  mergeLocalPageSettingsIntoFrontmatter,
} from "@/lib/local-frontmatter";
import {
  extractFrontmatter,
  decodeUnsupportedMarkdownForDisk,
} from "@/lib/markdown-raw-guard";
import {
  applyTrailingNewlineStyle,
  isLocalMdUnchanged,
  markSelfWrite,
  updateSnapshotAfterWrite,
} from "@/lib/local-md-snapshot";
import { hasExternalDiskChange } from "./conflict";
import { consumeDiskWriteFailure, DiskWriteError } from "@/lib/diskWriteError";
import { refreshSnapshotFingerprint } from "./persistence";

export const saveLocalPageContentUnlocked = async (
  set: StoreSet,
  get: StoreGet,
  gooseFs: NonNullable<Window["gooseFs"]>,
  pageId: string,
  content: JSONContent,
  options?: { force?: boolean },
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page) return false;

  let filePath = get().getLocalFilePath(pageId);
  if (!filePath) {
    if (!page.localUnsaved) return false;
    if (!localPageHasPersistableContent(content) && !options?.force) {
      return true;
    }
    filePath = await assignUnsavedLocalFilePathAction(set, get, pageId);
    if (!filePath) return false;
  }

  const duplicatePage = findDuplicateLocalFileOwner(
    get().pages,
    pageId,
    filePath,
  );
  if (duplicatePage) {
    console.error("[local-folder] refusing to save duplicate local file path", {
      pageId,
      duplicatePageId: duplicatePage.id,
      filePath,
    });
    window.dispatchEvent(
      new CustomEvent("goose-note:local-file-duplicate", {
        detail: {
          pageId,
          duplicatePageId: duplicatePage.id,
          filePath,
        },
      }),
    );
    return false;
  }

  const processedContent = cloneLocalPageContent(content);

  const assetsDir = filePath.replace(/[^\/\\]+$/, "") + "assets";

  // 先收集需要落盘的图片，真正有图片要写时才 mkdir——
  // 否则纯打开/flush（内容未变走 diff 跳过）也会在用户目录凭空创建 assets 文件夹。
  const pendingImageWrites = collectLocalImageWrites(
    processedContent,
    assetsDir,
  );

  const { blocksToMarkdown } = await import("@/lib/export");
  // 本地文件夹以可见的块级 span 持久化样式，Obsidian Live Preview 也会实际应用。
  // 普通导出、AI 上下文与 editor 仍各自使用原有序列化策略。
  const markdownContent = await blocksToMarkdown(
    encodeLocalBlockPropsWrappers(processedContent as any),
  );

  // 写盘前 merge 当前设置；YAML 异常抛错，由现有队列保留待写内容。
  // 首块已有 YAML 时就地合并，只有没有首块 YAML 才 prepend 独立 blob。
  const frontmatterHeaderMerge = mergeSettingsIntoFrontmatterHeader(
    markdownContent,
    {
      fontFamily: page.fontFamily ?? "default",
      pageLayout: page.pageLayout,
      isLocked: Boolean(page.isLocked),
      isPinned: Boolean(page.isPinned),
      isFavorite: Boolean(page.isFavorite),
    },
  );
  let frontmatterBlob: string | undefined;
  let finalContent: string;
  if (frontmatterHeaderMerge) {
    finalContent = frontmatterHeaderMerge.markdown;
    frontmatterBlob = frontmatterHeaderMerge.frontmatter;
  } else {
    const frontmatterMerge = mergeLocalPageSettingsIntoFrontmatter(
      page.localFrontmatter,
      {
        fontFamily: page.fontFamily ?? "default",
        pageLayout: page.pageLayout,
        isLocked: Boolean(page.isLocked),
        isPinned: Boolean(page.isPinned),
        isFavorite: Boolean(page.isFavorite),
      },
    );
    if (frontmatterMerge.parseFailed) {
      throw new Error("YAML 前置区格式异常，已阻止保存");
    }
    frontmatterBlob = frontmatterMerge.blob;
    finalContent = frontmatterBlob
      ? `${frontmatterBlob}\n\n${markdownContent}`
      : markdownContent;
  }

  if (!markdownContent.trim()) {
    let exists = false;
    try {
      exists = window.gooseFs?.exists(filePath) ?? false;
    } catch {
      // ignore fs check error
    }

    if (exists) {
      let oldContent: string;
      if (window.gooseFs?.readFileAsync) {
        oldContent = (await window.gooseFs.readFileAsync(filePath)) || "";
      } else {
        oldContent = window.gooseFs?.readFile(filePath) || "";
      }

      // 判断旧文件是否还有实质 body（去掉 frontmatter 后），避免误判 frontmatter 自身为有效内容
      const { body: oldBody } = extractFrontmatter(oldContent);
      if (oldBody && oldBody.trim().length > 10) {
        console.error("[Data Integrity] Refusing to save empty content.");
        return false;
      }
    }
  }

  // 编辑器表示 → 磁盘表示：解包 goose-raw fence（encodeUnsupportedMarkdownForEditor
  // 的逆操作）。落盘内容绝不能带围栏。此前由 main.tsx 的 gooseFs 写包装器代劳，
  // 守卫清理后 decode 职责收归这里（md 文本写盘唯一路径），diff/快照/写盘三者统一。
  // 再按快照原文还原尾换行风格：blocksToMarkdown 不带尾 \n，不还原会让每次编辑
  // 都丢掉原文件的 POSIX 尾换行，给 git diff 制造噪音。
  const diskContent = applyTrailingNewlineStyle(
    filePath,
    decodeUnsupportedMarkdownForDisk(finalContent),
  );

  // 保存前 diff 兜底：与磁盘快照比较（规范化后），完全相同则跳过写盘。
  // 防止「打开即写盘」——仅 normalize 或 frontmatter 无变化的情况触发的无意义落盘。
  if (isLocalMdUnchanged(filePath, diskContent)) {
    // 内容未变，按成功处理，清除脏标记（如果有的话）。
    set((s) => ({
      dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
    }));
    return true;
  }

  // ── 写盘前冲突检查 ──────────────────────────────────────────────────────────
  // 读一次磁盘当前内容，与快照比较（规范化后），不一致 = 外部已改 → 不写盘，触发冲突处理。
  // 这比仅与 store 内容比较更安全：保证不会静默覆盖外部编辑。
  if (!options?.force) {
    if (await hasExternalDiskChange(filePath, pageId, "pre-save")) return false;
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (pendingImageWrites.length > 0) {
    try {
      if (gooseFs.mkdir) {
        await gooseFs.mkdir(assetsDir);
      }
    } catch {
      // ignore mkdir error
    }
    await Promise.all(
      pendingImageWrites.map(({ imagePath, base64Data }) => {
        if (gooseFs.writeFileAsync) {
          return gooseFs.writeFileAsync(imagePath, base64Data, "base64");
        }
        return Promise.resolve(gooseFs.writeFile(imagePath, base64Data));
      }),
    );
  }

  // assets 写入和正文写盘之间仍可能被外部编辑器抢写；正文写入前再比对一次。
  if (
    !options?.force &&
    (await hasExternalDiskChange(filePath, pageId, "pre-write"))
  ) {
    return false;
  }

  // 写盘前标记自写：fs.watch 对本次写入触发的 change 事件（自写回声）
  // 由 useLocalFolderWatch 据此忽略，不会误判成外部修改弹冲突提示。
  markSelfWrite(filePath);
  let result: boolean;
  try {
    if (window.gooseFs?.writeFileAsync) {
      result = await window.gooseFs.writeFileAsync(filePath, diskContent);
    } else {
      result = window.gooseFs?.writeFile(filePath, diskContent) ?? false;
    }
  } catch (err) {
    throw (
      consumeDiskWriteFailure() ??
      new DiskWriteError(`无法写入文件：${filePath}`, {
        path: filePath,
        cause: err,
      })
    );
  }

  if (!result) {
    throw (
      consumeDiskWriteFailure() ??
      new DiskWriteError(`无法写入文件：${filePath}`, { path: filePath })
    );
  }

  if (result) {
    // 写成功后续期静默窗，覆盖写后延迟派发的 change 事件。
    markSelfWrite(filePath);
    // 落盘成功即清除脏标记（自动保存与显式保存共用此路径）。
    // 若合并成功，以落盘的头为磁盘一致的 localFrontmatter；merge 失败回退原 blob。
    const nextFrontmatter = frontmatterBlob ?? page.localFrontmatter;
    set((s) => {
      const current = s.pages[pageId];
      if (!current) {
        return {
          lastSavedAt: Date.now(),
          dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
        };
      }
      const frontmatterChanged =
        (current.localFrontmatter ?? undefined) !==
        (nextFrontmatter ?? undefined);
      return {
        lastSavedAt: Date.now(),
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
        ...(frontmatterChanged
          ? {
              pages: {
                ...s.pages,
                [pageId]: {
                  ...current,
                  localFrontmatter: nextFrontmatter || undefined,
                },
              },
            }
          : {}),
      };
    });
    // 写盘成功后更新快照为实际写入磁盘的内容，并补齐 mtime+size 指纹。
    updateSnapshotAfterWrite(filePath, diskContent);
    await refreshSnapshotFingerprint(filePath);
  }
  return result;
};
