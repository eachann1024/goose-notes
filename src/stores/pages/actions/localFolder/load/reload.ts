import type { StoreSet, StoreGet } from "../../hydrate";
import {
  parseLocalMarkdownContent,
  localFileTitleFromPath,
} from "@/lib/local-folder-scanner";
import {
  setLocalMdSnapshot,
  updateSnapshotStat,
} from "@/lib/local-md-snapshot";

// 外部进程修改了文件后，把磁盘内容重新读入 store（不触发脏标记 / 自动保存）。
// 若该文件有未保存的本地编辑（dirty）则跳过，避免覆盖用户输入。
export const reloadLocalPageFromDiskAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): Promise<void> => {
  if (typeof window === "undefined" || !window.gooseFs) return;

  const page = get().pages[pageId];
  if (!page || page.isFolder || !page.localFilePath) return;
  if (get().dirtyLocalPageIds[pageId]) return;

  const fs = window.gooseFs;
  const filePath = page.localFilePath;

  let markdown: string | null;
  let readError: string | undefined;
  try {
    if (fs.readFileStatAsync) {
      const result = await fs.readFileStatAsync(filePath);
      markdown = result.ok ? (result.content ?? "") : null;
      readError = result.error || undefined;
    } else if (fs.readFileStat) {
      const result = fs.readFileStat(filePath);
      markdown = result.ok ? (result.content ?? "") : null;
      readError = result.error || undefined;
    } else if (fs.readFileAsync) {
      markdown = await fs.readFileAsync(filePath);
    } else {
      markdown = fs.readFile(filePath);
    }
  } catch (error) {
    console.error("[local-folder] reload read failed", error);
    return;
  }

  const parsed = await parseLocalMarkdownContent(
    markdown,
    localFileTitleFromPath(filePath),
    readError,
  );

  // 外部变更后更新快照，保证下次写盘前 diff 与磁盘最新状态比较。
  if (typeof markdown === "string") {
    setLocalMdSnapshot(filePath, markdown);
    try {
      const stat = await window.gooseFs.statAsync?.(filePath);
      if (stat) updateSnapshotStat(filePath, stat);
    } catch {
      // 指纹失败不影响重载，下次 watch 退回读全文
    }
  }

  set((state) => {
    const current = state.pages[pageId];
    if (!current) return state;
    return {
      pages: {
        ...state.pages,
        [pageId]: {
          ...current,
          content: parsed.content,
          localFrontmatter: parsed.frontmatter,
          fontFamily: parsed.fontFamily,
          pageLayout: parsed.pageLayout,
          isLocked: parsed.isLocked,
          localReadState: parsed.readState,
          localReadError: parsed.readError,
          updatedAt: Date.now(),
        },
      },
    };
  });

  // 当前正在编辑的文件被外部修改 → 通知编辑器重载内容。
  if (get().activePageId === pageId) {
    window.dispatchEvent(
      new CustomEvent("goose-note:reload-active-editor", {
        detail: { pageId },
      }),
    );
  }
};
