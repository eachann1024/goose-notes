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

function normalizeComparisonPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function isPathInsideNotebookRoot(
  filePath: string,
  rootPath: string,
): boolean {
  const file = normalizeComparisonPath(filePath);
  const root = normalizeComparisonPath(rootPath).replace(/\/$/, "");
  return file === root || file.startsWith(`${root}/`);
}
