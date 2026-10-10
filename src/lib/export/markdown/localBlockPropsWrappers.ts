import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { documentTextColors } from "@/lib/textColors";
import { INLINE_BLOCK_TYPES, pickPersistedBlockProps, sanitizeCssColor, type MarkdownBlock, type PersistedBlockProps } from "./blockPropsProperties";

// toggleListItem 会序列化到 <summary> 内，不是一个可安全包裹的完整 Markdown 行。
const LOCAL_WRAPPABLE_BLOCK_TYPES = new Set(
  [...INLINE_BLOCK_TYPES].filter((type) => type !== "toggleListItem"),
);
export const LOCAL_BLOCK_PROPS_WRAPPER_STYLE = "__gooseLocalBlockPropsWrapperStyle";
const LOCAL_TEXT_COLOR_CSS = documentTextColors("light");
// 仅用于识别旧文档的 canonical wrapper，生成新文档始终使用全局文字色表。
const LEGACY_LOCAL_TEXT_COLOR_CSS: Record<string, string> = {
  gray: "#9b9a97", brown: "#64473a", red: "#e03e3e", orange: "#d9730d",
  yellow: "#dfab01", green: "#4d6461", blue: "#0b6e99", purple: "#6940a5", pink: "#ad1a72",
};
const LOCAL_BG_COLOR_CSS: Record<string, string> = {
  gray: "#ebeced", brown: "#e9e5e3", red: "#fbe4e4", orange: "#f6e9d9",
  yellow: "#fbf3db", green: "#ddedea", blue: "#ddebf1", purple: "#eae4f2", pink: "#f4dfeb",
};

function localCssColor(color: string, palette: Record<string, string>) {
  return palette[color] ?? color;
}

function localColorName(color: string, palette: Record<string, string>, legacyPalette: Record<string, string> = {}) {
  const match = [...Object.entries(palette), ...Object.entries(legacyPalette)]
    .find(([, css]) => css.toLowerCase() === color.toLowerCase());
  return match?.[0] ?? sanitizeCssColor(color);
}

function localWrapperStyle(metadata: PersistedBlockProps, textPalette = LOCAL_TEXT_COLOR_CSS): string {
  const styles = ["display:block"];
  if (metadata.textAlignment === "center" || metadata.textAlignment === "right") {
    styles.push(`text-align:${metadata.textAlignment}`);
  }
  if (metadata.textColor && metadata.textColor !== "default") {
    styles.push(`color:${localCssColor(metadata.textColor, textPalette)}`);
  }
  if (metadata.backgroundColor && metadata.backgroundColor !== "default") {
    styles.push(`background-color:${localCssColor(metadata.backgroundColor, LOCAL_BG_COLOR_CSS)}`);
  }
  return styles.join("; ");
}

function localWrapperMarker(metadata: PersistedBlockProps): string {
  return `<span data-goose-note-block-props="v1" style="${localWrapperStyle(metadata)}">`;
}

/**
 * 本地文件夹专用：让 Obsidian 等 Markdown 预览器真实应用块级样式。
 * 只包文本型块，媒体、代码和表格仍走各自已有的 Markdown 表示。
 */
export function encodeLocalBlockPropsWrappers(blocks: BlockNoteContent): BlockNoteContent {
  return (blocks as MarkdownBlock[]).map((block) => {
    const children = Array.isArray(block.children)
      ? encodeLocalBlockPropsWrappers(block.children as BlockNoteContent)
      : undefined;
    const metadata = block.type && (LOCAL_WRAPPABLE_BLOCK_TYPES.has(block.type) || block.type === "toggleListItem")
      ? pickPersistedBlockProps(block.props)
      : {};
    return {
      ...block,
      ...(Object.keys(metadata).length > 0
        ? { props: { ...(block.props ?? {}), [LOCAL_BLOCK_PROPS_WRAPPER_STYLE]: localWrapperStyle(metadata) } }
        : {}),
      ...(children ? { children } : {}),
    };
  }) as BlockNoteContent;
}

/** 仅由本地 writer 调用：在最终 Markdown 行形成后包上完整可见 wrapper。 */
export function wrapLocalBlockPropsMarkdown(block: MarkdownBlock, markdown: string): string {
  const style = block.props?.[LOCAL_BLOCK_PROPS_WRAPPER_STYLE];
  if (typeof style !== "string" || !parseLocalWrapperStyle(style)) return markdown;
  const open = `<span data-goose-note-block-props="v1" style="${style}">`;
  if (block.type === "toggleListItem") {
    return markdown.replace(
      /^(<summary>)([\s\S]*)(<\/summary>)$/m,
      (_source, start: string, inner: string, end: string) => `${start}${open}${inner}</span>${end}`,
    );
  }
  // 段落/标题保留一个跨行外层 wrapper，读入时由跨行 scanner 先完整剥离。
  // 引用序列化会给每行补 `> `，因此必须每行独立包裹才是有效 Markdown/HTML。
  const wrapLine = (line: string) => {
    const prefix = line.match(/^(\s*(?:(?:#{1,6}\s+)|(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)|(?:>\s+(?:\[![A-Z]+\]\s+\S+\s+)?))?)/)?.[1] ?? "";
    return `${prefix}${open}${line.slice(prefix.length)}</span>`;
  };
  if (block.type === "quote") return markdown.split("\n").map(wrapLine).join("\n");
  if (block.type === "callout") {
    return markdown.split("\n").map((line, index) => (
      index === 0 ? wrapLine(line) : `> ${open}${line.replace(/^>\s?/, "")}</span>`
    )).join("\n");
  }
  const firstLineEnd = markdown.indexOf("\n");
  if (firstLineEnd < 0) return wrapLine(markdown);
  const firstLine = markdown.slice(0, firstLineEnd);
  const prefix = firstLine.match(/^(\s*(?:#{1,6}\s+)?)/)?.[1] ?? "";
  return `${prefix}${open}${markdown.slice(prefix.length)}</span>`;
}

function parseLocalWrapperStyle(style: string): PersistedBlockProps | null {
  const tokens = style.split("; ");
  if (tokens[0] !== "display:block") return null;
  const raw: Record<string, unknown> = {};
  for (const token of tokens.slice(1)) {
    const [name, value, ...rest] = token.split(":");
    if (rest.length > 0 || !value) return null;
    if (name === "text-align") raw.textAlignment = value;
    else if (name === "color") raw.textColor = localColorName(value, LOCAL_TEXT_COLOR_CSS, LEGACY_LOCAL_TEXT_COLOR_CSS);
    else if (name === "background-color") raw.backgroundColor = localColorName(value, LOCAL_BG_COLOR_CSS);
    else return null;
  }
  const metadata = pickPersistedBlockProps(raw);
  return Object.keys(metadata).length > 0 && (
    localWrapperStyle(metadata) === style ||
    localWrapperStyle(metadata, LEGACY_LOCAL_TEXT_COLOR_CSS) === style
  )
    ? metadata
    : null;
}

/**
 * 在调用通用 Markdown inline parser 前剥离我们自己输出的完整行 wrapper。
 * data 属性、属性顺序和 canonical style 都必须匹配，用户普通 span 不会被误认。
 */
export function unwrapLocalBlockPropsWrappers(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  const prefix = "\\s*(?:(?:#{1,6}\\s+)|(?:[-*+]\\s+(?:\\[[ xX]\\]\\s+)?|\\d+\\.\\s+)|(?:>\\s+(?:\\[![A-Z]+\\]\\s+\\S+\\s+)?))?";
  const openPattern = new RegExp(`^(${prefix})(<span data-goose-note-block-props="v1" style="([^"]+)">)(.*)$`);
  const blockBoundary = /^(?:\s*$|\s*#{1,6}\s+|\s*>|\s*(?:[-*+]\s+|\d+\.\s+)|\s*(?:`{3,}|~{3,})|\s*<details>)/;
  const marker = (metadata: PersistedBlockProps) =>
    `<!-- goose-note:block-props=${encodeURIComponent(JSON.stringify({ v: 1, ...metadata }))} -->`;
  let fence: { char: "`" | "~"; length: number } | null = null;
  let previousQuoteStyle: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch && !fence) {
      const token = fenceMatch[1];
      fence = { char: token[0] as "`" | "~", length: token.length };
      output.push(line);
      previousQuoteStyle = null;
      continue;
    }
    if (fence) {
      const closeFence = new RegExp(`^\\s*${fence.char}{${fence.length},}\\s*$`);
      if (closeFence.test(line)) fence = null;
      output.push(line);
      continue;
    }

    const summary = line.match(/^(<summary>)<span data-goose-note-block-props="v1" style="([^"]+)">(.*)<\/span>(<\/summary>)$/);
    if (summary) {
      const metadata = parseLocalWrapperStyle(summary[2]);
      output.push(metadata ? `${summary[1]}${marker(metadata)}${summary[3]}${summary[4]}` : line);
      previousQuoteStyle = null;
      continue;
    }

    const opening = line.match(openPattern);
    if (!opening) {
      output.push(line);
      previousQuoteStyle = null;
      continue;
    }
    const [, linePrefix, , style, initialInner] = opening;
    const metadata = parseLocalWrapperStyle(style);
    if (!metadata) {
      output.push(line);
      previousQuoteStyle = null;
      continue;
    }
    const isQuote = /^\s*>/.test(linePrefix);
    const closeOnLine = initialInner.lastIndexOf("</span>");
    if (closeOnLine >= 0 && initialInner.slice(closeOnLine + 7) === "") {
      const inner = initialInner.slice(0, closeOnLine);
      // 连续 quote 行在 parser 中会合并成同一块，只有首行放 marker。
      output.push(`${linePrefix}${isQuote && previousQuoteStyle === style ? "" : marker(metadata)}${inner}`);
      previousQuoteStyle = isQuote ? style : null;
      continue;
    }

    // 只允许段落或 heading 走跨行 wrapper；列表/引用必须每行完整闭合。
    if (isQuote || /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(linePrefix)) {
      output.push(line);
      previousQuoteStyle = null;
      continue;
    }
    const innerLines = [initialInner];
    let depth = 1 + (initialInner.match(/<span\b/gi)?.length ?? 0) - (initialInner.match(/<\/span>/gi)?.length ?? 0);
    let closedAt = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (blockBoundary.test(lines[j])) break;
      const opens = lines[j].match(/<span\b/gi)?.length ?? 0;
      const closes = lines[j].match(/<\/span>/gi)?.length ?? 0;
      depth += opens - closes;
      innerLines.push(lines[j]);
      if (depth === 0 && lines[j].endsWith("</span>")) {
        innerLines[innerLines.length - 1] = lines[j].slice(0, -7);
        closedAt = j;
        break;
      }
      if (depth < 0) break;
    }
    if (closedAt < 0) {
      output.push(line);
      previousQuoteStyle = null;
      continue;
    }
    output.push(`${linePrefix}${marker(metadata)}${innerLines.join("\n")}`);
    i = closedAt;
    previousQuoteStyle = null;
  }
  return output.join("\n");
}
