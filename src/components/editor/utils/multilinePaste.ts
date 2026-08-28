import { normalizeClipboardLineEndings } from "./clipboard";

export const LIST_PASTE_BLOCK_TYPES = [
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
] as const;

export type ListPasteBlockType = (typeof LIST_PASTE_BLOCK_TYPES)[number];

const LIST_PASTE_BLOCK_TYPE_SET = new Set<string>(LIST_PASTE_BLOCK_TYPES);

const NON_TEXT_HTML_BLOCK =
  /<\s*(img|figure|picture|table|thead|tbody|tr|td|th|pre|video|audio|iframe)\b/i;

const LEADING_LIST_MARK =
  /^(?:\s*(?:[-*+]\s+\[[ xX]\]|\[[ xX]\]|\d+[.)、。]|[-*+]|[•·])\s+)/;

export function isListPasteBlockType(
  type: string | null | undefined,
): type is ListPasteBlockType {
  return typeof type === "string" && LIST_PASTE_BLOCK_TYPE_SET.has(type);
}

/**
 * 按换行拆成多块。没有换行返回 null（单行保持原块）。
 * 复制时常带末尾 `\n`，丢掉这一行空行，避免多出一个空块。
 */
export function splitPlainTextPasteLines(text: string): string[] | null {
  const normalized = normalizeClipboardLineEndings(text);
  if (!normalized.includes("\n")) return null;
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.length > 1 ? lines : null;
}

export function htmlHasNonTextPasteBlocks(htmlText: string): boolean {
  return NON_TEXT_HTML_BLOCK.test(htmlText || "");
}

export function resolveInheritedPasteBlockType(
  currentType: string | null | undefined,
): string {
  if (isListPasteBlockType(currentType)) return currentType;
  return "paragraph";
}

/** 粘进列表时去掉行首 markdown / 项目符号，避免「待办里再套一层 - 」。 */
export function stripInheritedListPrefix(line: string): string {
  return line.replace(LEADING_LIST_MARK, "");
}

export type InheritedPasteBlock = {
  type: string;
  content: string;
  props?: { checked: boolean };
};

export function buildInheritedPasteBlocks(
  lines: string[],
  blockType: string,
): InheritedPasteBlock[] {
  const inheritList = isListPasteBlockType(blockType);
  return lines.map((line) => {
    const content = inheritList ? stripInheritedListPrefix(line) : line;
    if (blockType === "checkListItem") {
      return { type: blockType, content, props: { checked: false } };
    }
    return { type: blockType, content };
  });
}

export function shouldSplitMultilinePaste(input: {
  lines: string[] | null;
  htmlText: string;
  inSoftWrap: boolean;
  inTable: boolean;
  multiBlockSelection: boolean;
}): boolean {
  if (!input.lines || input.lines.length < 2) return false;
  if (input.inSoftWrap || input.inTable || input.multiBlockSelection) {
    return false;
  }
  if (htmlHasNonTextPasteBlocks(input.htmlText)) return false;
  return true;
}

export type MultilinePastePlan = {
  firstLine: string;
  restBlocks: InheritedPasteBlock[];
};

export function planMultilinePaste(
  lines: string[],
  currentBlockType: string | null | undefined,
): MultilinePastePlan {
  const inheritType = resolveInheritedPasteBlockType(currentBlockType);
  const inheritList = isListPasteBlockType(currentBlockType);
  const rawFirst = lines[0] ?? "";
  return {
    firstLine: inheritList ? stripInheritedListPrefix(rawFirst) : rawFirst,
    restBlocks: buildInheritedPasteBlocks(lines.slice(1), inheritType),
  };
}

export type PasteContainerInspect = {
  inSoftWrap: boolean;
  inTable: boolean;
  listType: ListPasteBlockType | null;
  listEmpty: boolean;
};

type PmNodeLike = {
  type: { name: string };
  content: { size: number };
};

export function inspectPasteContainer($from: {
  depth: number;
  node: (depth: number) => PmNodeLike;
}): PasteContainerInspect {
  const result: PasteContainerInspect = {
    inSoftWrap: false,
    inTable: false,
    listType: null,
    listEmpty: false,
  };

  for (let d = $from.depth; d >= 1; d--) {
    const name = $from.node(d).type.name;
    if (name === "table" || name === "tableCell" || name === "tableHeader") {
      result.inTable = true;
    }
  }

  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (node.type.name !== "blockContainer") continue;
    const contentNode = d + 1 <= $from.depth ? $from.node(d + 1) : null;
    const contentName = contentNode?.type.name;
    if (contentName === "callout" || contentName === "quote") {
      result.inSoftWrap = true;
    } else if (isListPasteBlockType(contentName)) {
      result.listType = contentName;
      result.listEmpty = (contentNode?.content.size ?? 0) === 0;
    }
    break;
  }

  return result;
}
