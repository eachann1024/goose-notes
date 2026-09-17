import {
  htmlHasNonDefaultGooseBlockAttrs,
  looksLikeMarkdownFragment,
  normalizeClipboardLineEndings,
} from "./clipboard";

export const LIST_PASTE_BLOCK_TYPES = [
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
] as const;

export type ListPasteBlockType = (typeof LIST_PASTE_BLOCK_TYPES)[number];

const LIST_PASTE_BLOCK_TYPE_SET = new Set<string>(LIST_PASTE_BLOCK_TYPES);

/** 表格/代码/媒体才走默认 HTML 粘贴。微信表情等 <img> 不能挡住按行拆块。 */
const NON_TEXT_HTML_BLOCK =
  /<\s*(table|thead|tbody|tr|td|th|pre|video|audio|iframe)\b/i;

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

/** 系统剪贴板常丢掉 `blocknote/html`，只剩带 data-content-type 的内部切片。 */
export function htmlLooksLikeBlockNoteClipboard(html: string): boolean {
  const value = (html || "").trim();
  if (!value) return false;
  return (
    /data-node-type\s*=\s*["']block(?:Container|Group)["']/i.test(value) ||
    /data-content-type\s*=\s*["'][A-Za-z][A-Za-z0-9]+["']/i.test(value)
  );
}

/** 有格式的 HTML 交给编辑器解析；仅带 alt 的表情图片可继续按文本拆行。 */
export function htmlHasRichPasteContent(html: string): boolean {
  if (htmlLooksLikeBlockNoteClipboard(html)) return true;
  const hasImage = [...html.matchAll(/<img\b[^>]*>/gi)].some(([tag]) => {
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1];
    return !alt || !/^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(alt);
  });
  return (
    htmlHasNonTextPasteBlocks(html) ||
    htmlHasNonDefaultGooseBlockAttrs(html) ||
    /<\s*(strong|b|em|i|u|s|del|code|a|h[1-6]|ul|ol|li|blockquote)\b/i.test(html) ||
    /\bstyle\s*=\s*["'][^"']*(?:font-weight|font-style|text-decoration|color|text-align)\s*:/i.test(html) ||
    hasImage
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number.parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

/** 从 HTML 找回被 <br>/<p>/<div> 表达的换行；表情 img 用 alt。 */
export function htmlToPlainTextForPaste(htmlText: string): string {
  let s = htmlText || "";
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|meta|link)\b[^>]*\/?\s*>/gi, "");
  s = s.replace(/<img\b[^>]*\balt\s*=\s*(["'])([\s\S]*?)\1[^>]*>/gi, "$2");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(
    /<\s*\/\s*(p|div|li|h[1-6]|tr|blockquote|section|article|header|footer)\s*>/gi,
    "\n",
  );
  s = s.replace(
    /<\s*(p|div|li|h[1-6]|tr|blockquote|section|article)\b[^>]*>/gi,
    "\n",
  );
  s = s.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(s);
}

function dropLeadingEmptyLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start] === "") start += 1;
  return start === 0 ? lines : lines.slice(start);
}

/**
 * 优先用 text/plain 的换行；没有换行时从 HTML 的 br/块标签找回。
 * 微信/网页常把 CJK 换行写在 HTML 里，纯文本或默认 HTML 粘贴都会挤成一段。
 */
export function resolvePasteLines(
  plainText: string,
  htmlText: string,
): string[] | null {
  const fromPlain = splitPlainTextPasteLines(plainText);
  if (fromPlain && fromPlain.length >= 2) return fromPlain;
  const fromHtml = splitPlainTextPasteLines(htmlToPlainTextForPaste(htmlText));
  if (!fromHtml || fromHtml.length < 2) return fromPlain;
  const trimmed = dropLeadingEmptyLines(fromHtml);
  return trimmed.length >= 2 ? trimmed : fromPlain;
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
  if (htmlHasRichPasteContent(input.htmlText)) return false;
  if (looksLikeMarkdownFragment(input.lines.join("\n"))) return false;
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
