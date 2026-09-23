import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import type { Page } from "@/types";

const compareBySidebarOrder = (a: Page, b: Page) =>
  (a.order ?? a.createdAt) - (b.order ?? b.createdAt);

const isActiveNotebookPage = (page: Page | undefined, notebookId: string) =>
  !!page && page.workspaceId === notebookId && !page.trashedAt;

export function resolveNotebookLandingPageId(
  notebookId: string | null | undefined,
): string | null {
  if (!notebookId) return null;

  const notebooksStore = useNotebooks.getState();
  const notebook = notebooksStore.notebooks[notebookId];
  if (!notebook) return null;

  const pages = usePages.getState().pages;
  const lastPageId = notebooksStore.getLastActivePage(notebookId);
  const lastPage = lastPageId ? pages[lastPageId] : undefined;
  if (lastPageId && isActiveNotebookPage(lastPage, notebookId)) {
    return lastPageId;
  }

  // 本地文件夹首次打开保留空白入口；但已载入且曾打开过页面的本地库
  // 应即时复用内存缓存，后台扫描完成前不让主区回退为空白。
  if (notebook.source === "local-folder") return null;

  const firstValidPage = Object.values(pages)
    .filter((page) => isActiveNotebookPage(page, notebookId))
    .sort(compareBySidebarOrder)[0];

  return firstValidPage?.id ?? null;
}

export async function activateNotebook(
  notebookId: string,
): Promise<string | null> {
  const notebooksStore = useNotebooks.getState();
  if (!notebooksStore.notebooks[notebookId]) return null;

  notebooksStore.setActiveNotebook(notebookId);
  const landingPageId = resolveNotebookLandingPageId(notebookId);
  if (landingPageId) {
    useTabs.getState().syncActiveTabForPage(landingPageId);
  } else {
    await usePages.getState().setActivePage(null);
  }
  return landingPageId;
}
