export function getContentSnippet(
  contentText: string,
  query: string,
  contextLength = 30,
): { snippet: string; matchIndex: number } | undefined {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle || !contentText) return undefined;
  const matchIndex = contentText.toLocaleLowerCase().indexOf(needle);
  if (matchIndex < 0) return undefined;
  const lineStart = contentText.lastIndexOf("\n", matchIndex);
  const lineEnd = contentText.indexOf("\n", matchIndex + needle.length);
  const contextStart = Math.max(0, matchIndex - contextLength);
  const contextEnd = Math.min(contentText.length, matchIndex + needle.length + contextLength);
  const start = Math.max(lineStart < 0 ? 0 : lineStart, contextStart);
  const end = Math.min(lineEnd < 0 ? contentText.length : lineEnd, contextEnd);
  return {
    snippet: `${start > 0 ? "..." : ""}${contentText.slice(start, end)}${end < contentText.length ? "..." : ""}`,
    matchIndex: matchIndex - start + (start > 0 ? 3 : 0),
  };
}

export function countLiteralMatches(content: string, query: string): number {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const haystack = content.toLocaleLowerCase();
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count++;
    index += needle.length;
  }
  return count;
}
