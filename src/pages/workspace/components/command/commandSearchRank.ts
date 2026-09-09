/**
 * 有查询时的结果排序：标题匹配优先于正文命中，同档内保持传入顺序（MiniSearch 相关度）。
 */
export function titleMatchRank(title: string, query: string): number {
  const t = title.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 3;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return 3;
}

export function compareTitleMatchRank(
  titleA: string,
  titleB: string,
  query: string,
): number {
  return titleMatchRank(titleA, query) - titleMatchRank(titleB, query);
}
