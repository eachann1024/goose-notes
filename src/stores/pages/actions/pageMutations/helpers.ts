import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";

function compareSiblingPages(
  a: Page,
  b: Page,
  isLocalNotebook: boolean,
): number {
  if (isLocalNotebook) {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    const titleCompare = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
      numeric: true,
    });
    if (titleCompare !== 0) return titleCompare;
    return a.id.localeCompare(b.id);
  }

  const orderA = a.order ?? a.createdAt;
  const orderB = b.order ?? b.createdAt;
  if (orderA !== orderB) return orderA - orderB;
  return a.id.localeCompare(b.id);
}

export { compareSiblingPages };

function resolveAdjacentPageAfterDeletion({
  pages,
  currentPage,
  removedIds,
  isLocalNotebook,
}: {
  pages: Record<string, Page>;
  currentPage: Page;
  removedIds: Set<string>;
  isLocalNotebook: boolean;
}): string | null {
  const siblingsBeforeDelete = Object.values(pages)
    .filter(
      (candidate) =>
        candidate.workspaceId === currentPage.workspaceId &&
        !candidate.trashedAt &&
        candidate.parentId === currentPage.parentId,
    )
    .sort((a, b) => compareSiblingPages(a, b, isLocalNotebook));

  const deletedPageIndex = siblingsBeforeDelete.findIndex(
    (candidate) => candidate.id === currentPage.id,
  );
  const siblingsAfterDelete = siblingsBeforeDelete.filter(
    (candidate) => !removedIds.has(candidate.id),
  );

  if (siblingsAfterDelete.length === 0) {
    return null;
  }

  const fallbackIndex =
    deletedPageIndex === -1
      ? siblingsAfterDelete.length - 1
      : Math.min(deletedPageIndex, siblingsAfterDelete.length - 1);

  return siblingsAfterDelete[fallbackIndex]?.id ?? null;
}

export { resolveAdjacentPageAfterDeletion };
