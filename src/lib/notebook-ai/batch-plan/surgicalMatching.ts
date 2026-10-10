import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";

const LIST_ITEM_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

/**
 * 与 serializeBlocks 对齐：连续列表项合并为一段，其余一块一段。
 */
export function buildSegments(blocks: any[]): Array<{
  start: number;
  end: number;
  markdown: string;
}> {
  const segments: Array<{ start: number; end: number; markdown: string }> = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || typeof block !== "object") {
      i += 1;
      continue;
    }
    if (LIST_ITEM_TYPES.has(block.type)) {
      const start = i;
      while (i < blocks.length && LIST_ITEM_TYPES.has(blocks[i]?.type)) {
        i += 1;
      }
      const markdown = jsonContentToMarkdown(blocks.slice(start, i) as any);
      if (markdown !== "") {
        segments.push({ start, end: i - 1, markdown });
      }
      continue;
    }
    const markdown = jsonContentToMarkdown([block] as any);
    if (markdown !== "") {
      segments.push({ start: i, end: i, markdown });
    }
    i += 1;
  }
  return segments;
}

export function joinSegments(segments: Array<{ markdown: string }>): string {
  return segments.map((s) => s.markdown).join("\n\n");
}

export function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const positions: number[] = [];
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    positions.push(idx);
    from = idx + Math.max(needle.length, 1);
  }
  return positions;
}

/**
 * 折叠水平空白（空格/Tab）后的定位，并映射回原文区间。
 * 换行保留，避免跨段误匹配。
 */
export function findWhitespaceFlexible(
  haystack: string,
  needle: string,
): { index: number; matchedLength: number } | null {
  const normalize = (s: string) => {
    const norm: string[] = [];
    const map: number[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i]!;
      if (ch === " " || ch === "\t") {
        if (norm[norm.length - 1] !== " ") {
          norm.push(" ");
          map.push(i);
        }
        continue;
      }
      norm.push(ch);
      map.push(i);
    }
    return { text: norm.join(""), map };
  };

  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n.text) return null;
  const nIdx = h.text.indexOf(n.text);
  if (nIdx < 0) return null;

  const startOrig = h.map[nIdx];
  if (startOrig == null) return null;
  const endNorm = nIdx + n.text.length - 1;
  const endOrig = h.map[endNorm];
  if (endOrig == null) return null;
  return { index: startOrig, matchedLength: endOrig - startOrig + 1 };
}

export function mapCharRangeToBlocks(
  segments: Array<{ start: number; end: number; markdown: string }>,
  matchStart: number,
  matchEnd: number,
): { startBlock: number; endBlock: number } | null {
  if (segments.length === 0) return null;
  let cursor = 0;
  let startBlock: number | null = null;
  let endBlock: number | null = null;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    const segStart = cursor;
    const segEnd = cursor + seg.markdown.length;
    if (matchEnd > segStart && matchStart < segEnd) {
      if (startBlock == null) startBlock = seg.start;
      endBlock = seg.end;
    }
    cursor = segEnd + (i < segments.length - 1 ? 2 : 0);
  }

  if (startBlock == null || endBlock == null) return null;
  return { startBlock, endBlock };
}

export function locateInRegion(
  regionMd: string,
  find: string,
): { localStart: number; localLen: number } | null {
  const exact = regionMd.indexOf(find);
  if (exact >= 0) return { localStart: exact, localLen: find.length };
  const flex = findWhitespaceFlexible(regionMd, find);
  if (!flex) return null;
  return { localStart: flex.index, localLen: flex.matchedLength };
}
