import type { Node as PMNode, Slice } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import { normalizeClipboardLineEndings } from "./clipboardMarkdown";
/** 连续列表项（含嵌套子列表）之间用单个换行。 */
const COMPACT_LIST_BLOCK_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

const PARAGRAPH_LIKE_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "callout",
]);

function blockPlainTextSeparator(prev: string, next: string): string {
  if (
    COMPACT_LIST_BLOCK_TYPES.has(prev) &&
    COMPACT_LIST_BLOCK_TYPES.has(next)
  ) {
    return "\n";
  }
  return "\n\n";
}

function trimPlainTextLines(text: string): string {
  const normalized = normalizeClipboardLineEndings(text);
  return normalized
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/, ""))
    .join("\n")
    .trim();
}

function isCodePreservingBlock(node: PMNode): boolean {
  return node.type.spec.code === true || node.type.name === "codeBlock";
}

function shouldEmitPlainTextBlock(node: PMNode): boolean {
  if (isCodePreservingBlock(node) || node.type.name === "table") return true;
  if (
    COMPACT_LIST_BLOCK_TYPES.has(node.type.name) ||
    PARAGRAPH_LIKE_BLOCK_TYPES.has(node.type.name)
  ) {
    return true;
  }
  return node.isTextblock;
}

export type SerializePlainTextOptions = {
  /** 多块格式复制时带上 1. / - / # ，方便系统剪贴板丢掉内部 MIME 后仍能还原。 */
  includeBlockMarkers?: boolean;
};

function blockClipboardMarker(
  node: PMNode,
  numbered: { value: number },
): string {
  switch (node.type.name) {
    case "numberedListItem":
      numbered.value += 1;
      return `${numbered.value}. `;
    case "bulletListItem":
    case "toggleListItem":
      numbered.value = 0;
      return "- ";
    case "checkListItem":
      numbered.value = 0;
      return node.attrs.checked ? "- [x] " : "- [ ] ";
    case "heading": {
      numbered.value = 0;
      const level = Number(node.attrs.level) || 1;
      return `${"#".repeat(Math.min(6, Math.max(1, level)))} `;
    }
    case "quote":
    case "callout":
      numbered.value = 0;
      return "> ";
    default:
      numbered.value = 0;
      return "";
  }
}

function serializeTablePlainText(table: PMNode): string {
  const rows: string[] = [];
  table.forEach((row) => {
    if (row.type.spec.tableRole !== "row") return;
    const cells: string[] = [];
    row.forEach((cell) => {
      if (
        cell.type.spec.tableRole !== "cell" &&
        cell.type.spec.tableRole !== "header_cell"
      ) {
        return;
      }
      cells.push(cell.textContent);
    });
    if (cells.length > 0) rows.push(cells.join("\t"));
  });
  return normalizeClipboardLineEndings(rows.join("\n"));
}

/**
 * 按 BlockNote 块结构序列化选区 plain text，避免 PM 默认 `\n\n` 在
 * blockContainer / blockGroup 上产生空行，也避免 checkbox 等结构节点带出空格。
 */
export function serializeDocRangePlainText(
  doc: PMNode,
  from: number,
  to: number,
  options?: SerializePlainTextOptions,
): string {
  if (from >= to) return "";

  const $from = doc.resolve(from);
  const $to = doc.resolve(to);

  if ($from.sameParent($to) && $from.parent.isTextblock) {
    const text = doc.textBetween(from, to, "\n", "\n");
    if (isCodePreservingBlock($from.parent)) {
      return normalizeClipboardLineEndings(text);
    }
    return trimPlainTextLines(text);
  }

  const segments: { text: string; type: string }[] = [];
  const numbered = { value: 0 };
  const includeBlockMarkers = options?.includeBlockMarkers === true;

  doc.nodesBetween(from, to, (node, pos, parent) => {
    if (
      !parent ||
      parent.type.name !== "blockContainer" ||
      node !== parent.firstChild
    ) {
      return true;
    }
    if (!shouldEmitPlainTextBlock(node)) return true;

    if (node.type.name === "table") {
      segments.push({
        type: node.type.name,
        text: serializeTablePlainText(node),
      });
      return false;
    }

    const contentFrom = pos + 1;
    const contentTo = pos + node.nodeSize - 1;
    const sliceFrom = Math.max(from, contentFrom);
    const sliceTo = Math.min(to, contentTo);
    if (sliceFrom >= sliceTo) return true;

    const raw = doc.textBetween(sliceFrom, sliceTo, "\n", "\n");
    const marker = includeBlockMarkers
      ? blockClipboardMarker(node, numbered)
      : "";
    segments.push({
      type: node.type.name,
      text: marker ? `${marker}${raw}` : raw,
    });
    return isCodePreservingBlock(node) ? false : true;
  });

  let result = "";
  let prevType: string | null = null;
  for (const segment of segments) {
    if (!segment.text && prevType === null) continue;
    if (result) {
      result += blockPlainTextSeparator(prevType!, segment.type);
    }
    result += segment.text;
    prevType = segment.type;
  }

  const hasCode = segments.some((segment) => segment.type === "codeBlock");
  return hasCode
    ? normalizeClipboardLineEndings(result)
    : trimPlainTextLines(result);
}

export function serializeSlicePlainText(
  slice: Slice,
  options?: SerializePlainTextOptions,
): string {
  const first = slice.content.firstChild;
  if (!first || slice.content.size === 0) return "";
  const doc = first.type.schema.nodes.doc.create(null, slice.content);
  return serializeDocRangePlainText(doc, 1, doc.content.size - 1, options);
}

export function getEditorSelectionPlainText(state: EditorState): string {
  const { from, to, empty } = state.selection;
  if (empty) return "";
  return serializeDocRangePlainText(state.doc, from, to);
}
