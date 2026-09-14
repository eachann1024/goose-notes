import { toast } from "@/components/ui/sonner";
import {
  comparisonLocalPath,
  isCanonicalPathInside,
  localPathsAreCaseInsensitive,
} from "@/lib/canonicalLocalPath";
import { pageDirectory } from "@/lib/currentLocalPagePath";
import { activateNotebook } from "@/lib/notebookNavigation";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { markAssociatedMarkdownOpened } from "@/lib/workspaceStartup";
import type { Notebook } from "@/stores/useNotebooks";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";

function comparisonPath(filePath: string): string {
  return comparisonLocalPath(filePath, localPathsAreCaseInsensitive());
}

function isFileInsideRoot(filePath: string, rootPath: string): boolean {
  return isCanonicalPathInside(
    filePath,
    rootPath,
    localPathsAreCaseInsensitive(),
  );
}

export function findContainingLocalFolderNotebook(
  filePath: string,
  notebooks: Iterable<Notebook>,
): Notebook | undefined {
  const matches = [...notebooks].filter(
    (notebook) =>
      notebook.source === "local-folder" &&
      typeof notebook.localPath === "string" &&
      notebook.localPath.length > 0 &&
      isFileInsideRoot(filePath, notebook.localPath),
  );
  matches.sort(
    (left, right) => (right.localPath?.length ?? 0) - (left.localPath?.length ?? 0),
  );
  return matches[0];
}

function findPageIdByLocalFilePath(
  filePath: string,
  notebookId: string,
): string | null {
  const target = comparisonPath(filePath);
  const page = Object.values(usePages.getState().pages).find((candidate) => {
    if (candidate.workspaceId !== notebookId || candidate.isFolder) return false;
    if (!candidate.localFilePath) return false;
    return comparisonPath(candidate.localFilePath) === target;
  });
  return page?.id ?? null;
}

async function openPageInNotebook(
  notebookId: string,
  pageId: string,
): Promise<void> {
  closeNotebookAiIfFullscreen();
  await activateNotebook(notebookId);
  useTabs.getState().openTab(pageId);
  await usePages.getState().setActivePage(pageId);
}

export async function openAssociatedMarkdownFile(
  filePath: string,
): Promise<boolean> {
  const trimmed = filePath.trim();
  if (!trimmed) return false;

  let notebook = findContainingLocalFolderNotebook(
    trimmed,
    Object.values(useNotebooks.getState().notebooks),
  );

  if (!notebook) {
    const parentDir = pageDirectory(trimmed);
    if (!parentDir) {
      toast.error("无法打开该 Markdown 文件", {
        description: "文件不在可挂载的文件夹内。",
      });
      return false;
    }
    const folderName = parentDir.split(/[\\/]/).pop() || "Notes";
    const notebookId = useNotebooks
      .getState()
      .createLocalFolderNotebook(folderName, parentDir);
    await usePages.getState().loadLocalFolderPages(notebookId, parentDir);
    notebook = useNotebooks.getState().notebooks[notebookId];
  } else if (notebook.localPath) {
    await usePages
      .getState()
      .loadLocalFolderPages(notebook.id, notebook.localPath);
    notebook = useNotebooks.getState().notebooks[notebook.id] ?? notebook;
  }

  if (!notebook) return false;

  let pageId = findPageIdByLocalFilePath(trimmed, notebook.id);
  if (!pageId && notebook.localPath) {
    await usePages
      .getState()
      .addSingleLocalPage(notebook.id, notebook.localPath, trimmed, {
        force: true,
      });
    pageId = findPageIdByLocalFilePath(trimmed, notebook.id);
  }

  if (!pageId) {
    toast.error("无法打开该 Markdown 文件", {
      description: "文件不在当前仓库的可见笔记中。",
    });
    return false;
  }

  await openPageInNotebook(notebook.id, pageId);
  return true;
}

export async function openAssociatedMarkdownFiles(
  filePaths: string[],
): Promise<number> {
  const unique = [...new Set(filePaths.filter((value) => value.trim()))];
  if (unique.length === 0) return 0;

  let opened = 0;
  let firstPageId: string | null = null;
  let firstNotebookId: string | null = null;

  for (const filePath of unique) {
    const beforeActive = usePages.getState().activePageId;
    const ok = await openAssociatedMarkdownFile(filePath);
    if (!ok) continue;
    opened += 1;
    const afterActive = usePages.getState().activePageId;
    if (afterActive && afterActive !== beforeActive && !firstPageId) {
      firstPageId = afterActive;
      firstNotebookId = usePages.getState().pages[afterActive]?.workspaceId ?? null;
    }
  }

  if (opened > 0) {
    markAssociatedMarkdownOpened();
  }

  if (opened > 1 && firstPageId && firstNotebookId) {
    await openPageInNotebook(firstNotebookId, firstPageId);
  }

  return opened;
}

export async function consumePendingAssociatedMarkdownFiles(): Promise<number> {
  const api = getGooseDesktop();
  if (!api?.takePendingOpenMarkdownFiles) return 0;
  try {
    const files = await api.takePendingOpenMarkdownFiles();
    if (!Array.isArray(files) || files.length === 0) return 0;
    return openAssociatedMarkdownFiles(files);
  } catch (error) {
    console.error("[open-md] 读取待打开文件失败", error);
    return 0;
  }
}
