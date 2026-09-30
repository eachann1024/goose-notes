export function pageDirectory(pagePath: string): string {
  return pagePath.replace(/[\\/][^\\/]+$/, "");
}

export async function currentLocalPagePath(): Promise<string | null> {
  const [{ usePages }, { useNotebooks }] = await Promise.all([
    import("@/stores/usePages"),
    import("@/stores/useNotebooks"),
  ]);
  const { activePageId, pages } = usePages.getState();
  if (!activePageId) return null;
  const page = pages[activePageId];
  if (!page?.localFilePath) return null;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  return notebook?.source === "local-folder" ? page.localFilePath : null;
}

export async function currentLocalNotebookRoot(): Promise<string | null> {
  const [{ usePages }, { useNotebooks }] = await Promise.all([
    import("@/stores/usePages"),
    import("@/stores/useNotebooks"),
  ]);
  const { activePageId, pages } = usePages.getState();
  if (!activePageId) return null;
  const page = pages[activePageId];
  if (!page?.localFilePath) return null;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  return notebook?.source === "local-folder"
    ? (notebook.localPath ?? null)
    : null;
}

import {
  isCanonicalPathInside,
  localPathsAreCaseInsensitive,
} from "@/lib/canonicalLocalPath";

export function isPathInsideNotebookRoot(
  filePath: string,
  rootPath: string,
): boolean {
  return isCanonicalPathInside(
    filePath,
    rootPath,
    localPathsAreCaseInsensitive(),
  );
}
