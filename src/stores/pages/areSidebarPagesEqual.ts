import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";

function treeSignature(page: Page): string {
  return [
    page.workspaceId,
    page.parentId ?? "",
    page.icon ?? "",
    page.isFolder ? "1" : "0",
    String(page.trashedAt ?? ""),
    String(page.order ?? ""),
    String(page.createdAt),
    page.localFilePath ?? "",
    page.localUnsaved ? "1" : "0",
    page.localPendingCreate ?? "",
    page.localReadState ?? "",
    page.isPinned ? "1" : "0",
    page.isFavorite ? "1" : "0",
    getPageTitle(page),
  ].join("\0");
}

/** 侧栏树只关心标题和结构。正文编辑会换 pages 引用，不能因此重绘整棵树。 */
export function areSidebarPagesEqual(
  left: Record<string, Page>,
  right: Record<string, Page>,
): boolean {
  if (left === right) return true;
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  if (leftIds.length !== rightIds.length) return false;
  for (const id of leftIds) {
    const a = left[id];
    const b = right[id];
    if (a === b) continue;
    if (!b) return false;
    if (treeSignature(a) !== treeSignature(b)) return false;
  }
  return true;
}
