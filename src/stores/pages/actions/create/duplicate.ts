import type { StoreSet, StoreGet } from "../hydrate";
import { flushEditorContent } from "../flushEditor";
import { useNotebooks } from "../../../useNotebooks";
import {
  mergeLocalPageSettingsIntoFrontmatter,
  mergeSettingsIntoFrontmatterHeader,
} from "@/lib/local-frontmatter";
import { toast } from "@/components/ui/sonner";
import {
  extractFrontmatter,
  decodeUnsupportedMarkdownForDisk,
} from "@/lib/markdown-raw-guard";
import { encodeLocalBlockPropsWrappers } from "@/lib/export/markdown/blockPropsMarker";
import { cloneLocalPageContent } from "./content";
import {
  applyTrailingNewlineStyle,
  markSelfWrite,
  setLocalMdSnapshot,
} from "@/lib/local-md-snapshot";
import {
  readLocalPageIdMap,
  toRelativePath,
  resolveOrCreateStableId,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import type { Page } from "@/types";
import { persistPageSnapshot } from "../../persistence";
import { v4 as uuidv4 } from "uuid";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";

export const duplicatePageAction = async (
  set: StoreSet,
  get: StoreGet,
  id: string,
): Promise<string> => {
  flushEditorContent();

  const sourcePage = get().pages[id];
  if (!sourcePage) return id;

  const notebook = useNotebooks.getState().notebooks[sourcePage.workspaceId];
  if (notebook?.source === "local-folder") {
    if (sourcePage.isFolder || !sourcePage.localFilePath) {
      return id;
    }
    const fs = window.gooseFs;
    if (!fs) return id;

    const sourcePath = sourcePage.localFilePath;
    const isWindows = sourcePath.includes("\\") && !sourcePath.includes("/");
    const slash = isWindows ? "\\" : "/";
    const lastSlash = Math.max(
      sourcePath.lastIndexOf("/"),
      sourcePath.lastIndexOf("\\"),
    );
    const dir = lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : "";
    const fileName =
      lastSlash >= 0 ? sourcePath.slice(lastSlash + 1) : sourcePath;
    const dotIdx = fileName.lastIndexOf(".");
    const baseName = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
    const ext = dotIdx > 0 ? fileName.slice(dotIdx) : ".md";

    // 碰撞检测必须等 async exists（Electron 同步 exists 只读冷缓存，未命中会误判不存在）。
    const checkExists = async (path: string): Promise<boolean> => {
      if (fs.existsAsync) {
        return await fs.existsAsync(path);
      }
      return fs.exists?.(path) ?? false;
    };

    let copyIndex = 1;
    let candidateName = `${baseName}_副本${ext}`;
    let candidatePath = dir ? `${dir}${slash}${candidateName}` : candidateName;

    while (
      (await checkExists(candidatePath)) ||
      Object.values(get().pages).some(
        (p) =>
          p.localFilePath === candidatePath ||
          p.localFilePath?.replace(/\\/g, "/") ===
            candidatePath.replace(/\\/g, "/"),
      )
    ) {
      copyIndex += 1;
      candidateName = `${baseName}_副本 ${copyIndex}${ext}`;
      candidatePath = dir ? `${dir}${slash}${candidateName}` : candidateName;
    }

    const copySettings = {
      fontFamily: sourcePage.fontFamily ?? "default",
      pageLayout: sourcePage.pageLayout,
      isLocked: Boolean(sourcePage.isLocked),
      isPinned: false,
      isFavorite: false,
    };
    const copyFmMerge = mergeLocalPageSettingsIntoFrontmatter(
      sourcePage.localFrontmatter,
      copySettings,
    );
    if (copyFmMerge.parseFailed) {
      toast.error("YAML 前置区格式异常，未创建副本");
      return id;
    }
    let copyFrontmatterBlob = copyFmMerge.blob;

    // 异步读取源文件真实内容；读不到（如 Electron 无同步 IPC）则从内存页序列化正文，
    // 避免只写 frontmatter 丢正文。
    // 若是副份，编辑器首块已是 yaml-frontmatter，把副份设置 merge 进该头，
    // 不要「抽 body + prepend」，否则同文件会写出两个 --- 头。
    let fileContent = "";
    let rawMd: string | null = null;
    try {
      if (fs.readFileAsync) {
        rawMd = await fs.readFileAsync(sourcePath);
      } else if (fs.readFile) {
        rawMd = fs.readFile(sourcePath);
      }
    } catch {
      // 仅读取失败可回退内存，YAML 合并失败不能绕过保护。
    }
    try {
      if (rawMd != null) {
        const headerMerge = mergeSettingsIntoFrontmatterHeader(
          rawMd,
          copySettings,
        );
        if (headerMerge) {
          fileContent = headerMerge.markdown;
          copyFrontmatterBlob = headerMerge.frontmatter;
        } else {
          const { body } = extractFrontmatter(rawMd);
          fileContent = copyFrontmatterBlob
            ? `${copyFrontmatterBlob}\n\n${body}`
            : body;
        }
      }
    } catch {
      toast.error("YAML 前置区格式异常，未创建副本");
      return id;
    }

    if (!fileContent) {
      const { blocksToMarkdown } = await import("@/lib/export");
      const markdownContent = await blocksToMarkdown(
        encodeLocalBlockPropsWrappers(
          cloneLocalPageContent(sourcePage.content) as any,
        ),
      );
      let headerMerge;
      try {
        headerMerge = mergeSettingsIntoFrontmatterHeader(
          markdownContent,
          copySettings,
        );
      } catch {
        toast.error("YAML 前置区格式异常，未创建副本");
        return id;
      }
      if (headerMerge) {
        fileContent = headerMerge.markdown;
        copyFrontmatterBlob = headerMerge.frontmatter;
      } else {
        fileContent = copyFrontmatterBlob
          ? `${copyFrontmatterBlob}\n\n${markdownContent}`
          : markdownContent;
      }
    }

    const diskContent = applyTrailingNewlineStyle(
      candidatePath,
      decodeUnsupportedMarkdownForDisk(fileContent),
    );

    markSelfWrite(candidatePath);
    const writeOk = fs.writeFileAsync
      ? await fs.writeFileAsync(candidatePath, diskContent)
      : fs.writeFile
        ? fs.writeFile(candidatePath, diskContent)
        : false;
    if (!writeOk) return id;

    setLocalMdSnapshot(candidatePath, diskContent);

    const basePath = notebook.localPath || "";
    const idMap = readLocalPageIdMap(notebook.id);
    const relativePath = toRelativePath(basePath, candidatePath);
    const { id: newId, dirty } = resolveOrCreateStableId(
      notebook.id,
      relativePath,
      idMap,
    );
    if (dirty) {
      writeLocalPageIdMap(notebook.id, idMap);
    }

    const now = Date.now();
    const clonedContent = cloneLocalPageContent(sourcePage.content);

    const newPage: Page = {
      ...sourcePage,
      id: newId,
      workspaceId: notebook.id,
      parentId: sourcePage.parentId,
      localFilePath: candidatePath,
      localFrontmatter: copyFrontmatterBlob,
      content: clonedContent,
      isPinned: false,
      pinnedAt: undefined,
      isFavorite: false,
      favoriteOrder: undefined,
      createdAt: now,
      updatedAt: now,
      order: (sourcePage.order ?? 0) + 1,
      localReadState: "ready",
      localReadError: undefined,
    };

    set((state) => ({
      pages: {
        ...state.pages,
        [newId]: newPage,
      },
    }));

    persistPageSnapshot(get().pages[newId]);
    return newId;
  }

  let newId = "";
  set((state) => {
    const page = state.pages[id];
    if (!page) return state;

    newId = uuidv4();
    const now = Date.now();

    const clonedContent = structuredClone(page.content);
    if (
      clonedContent.content?.[0]?.type === "heading" &&
      clonedContent.content[0].attrs?.level === 1
    ) {
      const titleNode = clonedContent.content[0];
      const titleText = extractTitleFromContent(page.content);
      titleNode.content = [{ type: "text", text: `${titleText}_副本` }];
    }

    const newPage: Page = {
      ...page,
      id: newId,
      content: clonedContent,
      updatedAt: now,
      createdAt: now,
      trashedAt: undefined,
      isFavorite: false,
      isPinned: false,
      pinnedAt: undefined,
      order: now,
    };

    return {
      pages: {
        ...state.pages,
        [newId]: newPage,
      },
    };
  });
  persistPageSnapshot(get().pages[newId]);
  return newId;
};
