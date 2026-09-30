/** 语言搜索列表的高亮下标：有关键词时落在第一项，否则尽量对准当前语言。 */
export function defaultLanguageHighlightIndex(
  languages: readonly string[],
  search: string,
  currentLanguage: string,
): number {
  if (languages.length === 0) return 0;
  if (search.trim()) return 0;
  const current = currentLanguage.toLowerCase();
  const index = languages.findIndex((lang) => lang.toLowerCase() === current);
  return index >= 0 ? index : 0;
}

export function moveLanguageHighlightIndex(
  current: number,
  count: number,
  delta: number,
): number {
  if (count <= 0) return 0;
  const clamped = Math.min(Math.max(current, 0), count - 1);
  return (clamped + delta + count) % count;
}
