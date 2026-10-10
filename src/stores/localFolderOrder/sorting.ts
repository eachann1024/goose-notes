import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";

export function compareNames(a: Page, b: Page): number {
  const byName = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
    numeric: true,
  });
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

/**
 * 本地文件夹子项排序，侧栏树与目录主页共用，保证两处顺序一致。
 * - 无手动顺序：文件夹优先，再按名称（与访达一致）；
 * - 有手动顺序：按手动顺序，不在表内的项（尚未追加进顺序的新条目）排末尾。
 * 两种模式都不看 Page.order，扫描刷新不会打乱顺序。
 */
export function sortLocalFolderChildren(
  pages: Page[],
  manualOrder: string[] | undefined,
): Page[] {
  const rank = manualOrder
    ? new Map(manualOrder.map((id, index) => [id, index]))
    : null;
  const unknownRank = rank ? rank.size : 0;

  return [...pages].sort((a, b) => {
    if (!!a.localPendingCreate !== !!b.localPendingCreate) {
      return a.localPendingCreate ? -1 : 1;
    }
    if (rank) {
      const rankA = rank.get(a.id) ?? unknownRank;
      const rankB = rank.get(b.id) ?? unknownRank;
      if (rankA !== rankB) return rankA - rankB;
    } else if (!!a.isFolder !== !!b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return compareNames(a, b);
  });
}
