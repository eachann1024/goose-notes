import type { Node as PMNode, Slice } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent } from "mdast";

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
  if (isCodePreservingBlock(node)) return true;
  if (
    COMPACT_LIST_BLOCK_TYPES.has(node.type.name) ||
    PARAGRAPH_LIKE_BLOCK_TYPES.has(node.type.name)
  ) {
    return true;
  }
  return node.isTextblock;
}

/**
 * 按 BlockNote 块结构序列化选区 plain text，避免 PM 默认 `\n\n` 在
 * blockContainer / blockGroup 上产生空行，也避免 checkbox 等结构节点带出空格。
 */
export function serializeDocRangePlainText(
  doc: PMNode,
  from: number,
  to: number,
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

  doc.nodesBetween(from, to, (node, pos, parent) => {
    if (
      !parent ||
      parent.type.name !== "blockContainer" ||
      node !== parent.firstChild
    ) {
      return true;
    }
    if (!shouldEmitPlainTextBlock(node)) return true;

    const contentFrom = pos + 1;
    const contentTo = pos + node.nodeSize - 1;
    const sliceFrom = Math.max(from, contentFrom);
    const sliceTo = Math.min(to, contentTo);
    if (sliceFrom >= sliceTo) return true;

    segments.push({
      type: node.type.name,
      text: doc.textBetween(sliceFrom, sliceTo, "\n", "\n"),
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
  return hasCode ? normalizeClipboardLineEndings(result) : trimPlainTextLines(result);
}

export function serializeSlicePlainText(slice: Slice): string {
  const first = slice.content.firstChild;
  if (!first || slice.content.size === 0) return "";
  const doc = first.type.schema.nodes.doc.create(null, slice.content);
  return serializeDocRangePlainText(doc, 1, doc.content.size - 1);
}

export function getEditorSelectionPlainText(state: EditorState): string {
  const { from, to, empty } = state.selection;
  if (empty) return "";
  return serializeDocRangePlainText(state.doc, from, to);
}

const clipboardMarkdownParser = unified().use(remarkParse);

export function normalizeClipboardListMarkers(text: string): string {
  const offsets: number[] = [];
  const visit = (node: Root | RootContent) => {
    if (node.type === "list" && !node.ordered) {
      for (const item of node.children) {
        const offset = item.position?.start.offset;
        if (offset != null && (text[offset] === "*" || text[offset] === "+")) {
          offsets.push(offset);
        }
      }
    }
    if ("children" in node) node.children.forEach(visit);
  };
  visit(clipboardMarkdownParser.parse(text));
  for (const offset of offsets.sort((a, b) => b - a)) {
    text = text.slice(0, offset) + "-" + text.slice(offset + 1);
  }
  return text;
}

export function normalizeClipboardLineEndings(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\r\u2028\u2029\u0085]/g, "\n");
}

export function looksLikeMarkdownFragment(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|\s*[•·]\s|\s*\.\s)/m.test(value) ||
    /```/.test(value) ||
    /\|.+\|/.test(value) ||
    /(\*\*|__|~~|`[^`]+`)/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value) ||
    /\[\[[^\]\n]+\]\]/.test(value)
  );
}

const MERMAID_START_PATTERNS = [
  /^(?:graph|flowchart)\s+(?:TB|TD|BT|RL|LR)\b/i,
  /^sequenceDiagram\b/i,
  /^classDiagram(?:-v2)?\b/i,
  /^stateDiagram(?:-v2)?\b/i,
  /^erDiagram\b/i,
  /^journey\b/i,
  /^gantt\b/i,
  /^pie(?:\s+title\b|\b)/i,
  /^gitGraph\b/i,
  /^mindmap\b/i,
  /^timeline\b/i,
  /^quadrantChart\b/i,
  /^requirementDiagram\b/i,
  /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/,
  /^sankey-beta\b/i,
  /^xychart-beta\b/i,
  /^block-beta\b/i,
  /^packet-beta\b/i,
  /^architecture-beta\b/i,
];

export function looksLikeMermaidDiagram(text: string): boolean {
  const normalized = normalizeClipboardLineEndings(text).trim();
  if (!normalized || normalized.includes("```")) return false;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstContentLine = lines.find(
    (line) => !line.startsWith("%%") && !/^---$/.test(line),
  );
  if (!firstContentLine) return false;
  if (!MERMAID_START_PATTERNS.some((pattern) => pattern.test(firstContentLine))) {
    return false;
  }

  // 避免用户只粘了一个 Mermaid 声明词时误转。真实图表通常还有一行内容，
  // 或同一行已经包含标题/数据/关系语法。
  return (
    lines.length > 1 ||
    /(-->|---|==>|-.->|:\s|title\s+|accTitle\s*:|accDescr\s*:)/i.test(
      firstContentLine,
    )
  );
}

export function stripMarkdownHardBreaks(text: string): string {
  return normalizeClipboardLineEndings(text)
    .replace(/\\\n/g, "\n")
    .replace(/ {2,}\n/g, "\n")
    .replace(/\\$/g, "");
}

export function normalizeMarkdownPasteText(text: string): string {
  return stripMarkdownHardBreaks(text).replace(
    /^(\s*)(?:[•·]|\.)\s+/gm,
    "$1- ",
  );
}

export function parseMarkdownLink(text: string): { text: string; url: string } | null {
  const match = text.trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (!match) return null;
  return { text: match[1], url: match[2] };
}

function stripMarkdownHardBreakArtifacts(value: string): string {
  return normalizeClipboardLineEndings(value)
    .replace(/\\\n/g, "\n")
    .replace(/ {2,}\n/g, "\n");
}

function unwrapMarkdownAutolink(value: string): string | null {
  const normalized = normalizeClipboardLineEndings(value).trim();
  const match = normalized.match(/^<([^<>\s]+)>$/);
  return match?.[1] ?? null;
}

export function shouldPreferVisibleSelectionText(
  clipboardText: string,
  selectedText: string,
  withinCodeBlock: boolean,
): boolean {
  if (!selectedText) return false;
  if (withinCodeBlock) return true;
  if (unwrapMarkdownAutolink(clipboardText) === selectedText.trim()) return true;
  if (!clipboardText.includes("\\\n") && !clipboardText.match(/ {2,}\n/)) return false;
  return stripMarkdownHardBreakArtifacts(clipboardText) === selectedText;
}

/**
 * 判断剪贴板内容是否为「块结构」(非纯单行文本)——用于「标题一隔离」：光标在标题一时，
 * 块结构应落到标题下方而非注入标题。判定为「块结构」的依据(命中任一即是)：
 * - HTML 含块级标签：img/figure/table/pre/code/ul/ol/li/h1-6/blockquote/hr/p×多 等；
 * - 纯文本含块级 Markdown：标题(# )/列表(- 1.)/待办/代码围栏(```)/表格(|...|)/引用(> )/分隔线；
 * - 纯文本含换行(多行)——标题是单行的，多行内容应落正文。
 * 反之：单行纯文本、或仅含 inline 标签(b/i/a/strong/em/span/code-inline)的 HTML → 非块结构，
 * 照常注入标题文字。
 */
export function looksLikeBlockStructure(
  plainText: string,
  htmlText: string,
): boolean {
  const html = (htmlText || "").trim();
  if (html) {
    // 块级标签出现即视为块结构。
    if (
      /<\s*(img|figure|picture|table|thead|tbody|tr|td|th|pre|ul|ol|li|h[1-6]|blockquote|hr|video|audio|iframe)\b/i.test(
        html,
      )
    ) {
      return true;
    }
    // 多个 <p>/<div> 段落 → 多块结构。
    const blockParaCount = (html.match(/<\s*(p|div)\b/gi) || []).length;
    if (blockParaCount >= 2) return true;
  }

  const text = (plainText || "").trim();
  if (!text) return false;
  // 含换行 = 多行 → 落正文。
  if (/\n/.test(text)) return true;
  // 单行但含块级 Markdown 语法。
  if (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|>\s|```|\|.+\||-{3,}$)/.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

export function isValidUrl(text: string): boolean {
  if (!text) return false;
  // 协议 URL
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+/i.test(text)) return true;
  // www. 开头的 URL
  if (/^www\.\S+\.\S{2,}/i.test(text)) return true;
  // 域名格式 of URL (example.com/path)——形状正则只管「像域名」(≥2 段标签)，
  // 语义交给 isLinkworthyText 的 TLD 白名单，否则 Java 全限定名
  // (cn.cerc.mis.core.AppClient)、文件名(AppClient.java)会被误判成 URL。
  if (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/\S*)?$/i.test(text) &&
    isLinkworthyText(text)
  ) {
    return true;
  }
  return false;
}

// ===== 自动建链边界 =====
// BlockNote 的 autolink/pasteRule 用 linkifyjs 按「真实 TLD 全表」识别裸域名，
// 而 .java/.md/.sh/.app 等既是真实 TLD 又是常见文件后缀，导致粘贴
// `AppClient.java`、`cn.cerc.mis.core.AppClient` 这类类名/文件名被误转成链接。
// 原则：宁可漏建链(真链接用户仍可 Cmd-K 手动建)，也不误建链。

// 裸域名(无协议、无 www.)允许自动建链的常用 TLD 白名单。
// 刻意排除与代码文件后缀 / macOS 应用名冲突的真实 TLD：
// java、md、sh、rs、so、cc、pl、zip、mov、app 等。
const BARE_DOMAIN_TLDS = new Set([
  "com", "net", "org", "io", "dev", "ai", "cn", "co", "me", "edu",
  "gov", "mil", "info", "biz", "tv", "im", "ly", "to", "us", "uk",
  "jp", "de", "fr", "ru", "br", "in", "kr", "hk", "tw", "sg",
  "au", "ca", "it", "es", "nl", "se", "ch", "at", "fi", "no",
  "dk", "cz", "pt", "tr", "mx", "id", "th", "vn", "my", "ph",
  "nz", "za", "eu", "xyz", "top", "site", "online", "store", "tech", "fun",
  "live", "news", "work", "world", "zone", "cloud", "club", "space", "vip", "pro",
  "link", "run", "mobi", "name", "asia", "fm", "am", "gg", "wiki", "blog",
  "email", "design", "page", "one", "icu", "ren", "wang", "la", "moe",
]);

const HAS_URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_LINK_SCHEMES = /^(https?|ftps?|mailto|tel|callto|sms|cid|xmpp):/i;

/**
 * 判断一段文本是否「值得」成为链接。接入两处：
 * - BlockNote 编辑器选项 links.isValidLink(autolink/粘贴/HTML 导入的统一闸口，
 *   autolink 传入的是匹配原文如 `AppClient.java`，HTML 导入传入的是带协议 href)；
 * - 本文件 isValidUrl 的裸域名分支(整段粘贴是 URL 时的判定)。
 */
function gooseDataAttrHasNonDefaultValue(
  html: string,
  attrName: string,
  defaultValues: string[],
): boolean {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*=\\s*(["'])([^"']*)\\1`, "gi");
  const defaults = new Set(defaultValues.map((v) => v.toLowerCase()));
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const value = match[2].trim().toLowerCase();
    if (!defaults.has(value)) return true;
  }
  return false;
}

/** Goose 块级 data 属性是否为非默认值（不含 strong/span 等行内格式）。 */
export function htmlHasNonDefaultGooseBlockAttrs(htmlText: string): boolean {
  const html = (htmlText || "").trim();
  if (!html) return false;
  if (
    gooseDataAttrHasNonDefaultValue(html, "data-background-color", ["default"])
  ) {
    return true;
  }
  if (gooseDataAttrHasNonDefaultValue(html, "data-text-color", ["default"])) {
    return true;
  }
  if (
    gooseDataAttrHasNonDefaultValue(html, "data-text-alignment", [
      "default",
      "left",
    ])
  ) {
    return true;
  }
  return false;
}

/** 剪贴板 HTML 是否含可保留格式（行内样式、Goose 块属性、标题、引用等）。 */
export function htmlHasPreservableFormatting(htmlText: string): boolean {
  const html = (htmlText || "").trim();
  if (!html) return false;
  if (/<\s*(strong|b|em|i|u|s|del|code|a|span|mark)\b/i.test(html)) {
    return true;
  }
  if (/data-background-color|data-text-color|data-text-alignment/i.test(html)) {
    return true;
  }
  if (/style\s*=[^>]*(?:\bcolor\b|\bbackground\b)/i.test(html)) {
    return true;
  }
  if (/<\s*h[1-6]\b/i.test(html)) {
    return true;
  }
  if (/<\s*blockquote\b/i.test(html)) {
    return true;
  }
  return false;
}

export function isLinkworthyText(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // 带 scheme(含 `host:port` 形态会被当 scheme 拒掉，无协议带端口的粘贴可接受漏建链)
  if (HAS_URI_SCHEME.test(v)) return ALLOWED_LINK_SCHEMES.test(v);
  if (/^www\./i.test(v)) return true;
  // 邮箱 → autolink 会转 mailto
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true;
  // 裸域名：大写字母是 CamelCase 类名/文件名特征，直接拒；TLD 必须在白名单内。
  const host = v.split(/[/?#]/)[0];
  if (host !== host.toLowerCase()) return false;
  const tld = host.split(".").pop() ?? "";
  return BARE_DOMAIN_TLDS.has(tld);
}
