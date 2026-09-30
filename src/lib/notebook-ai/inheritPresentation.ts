/**
 * AI 经 Markdown 往返会丢掉块级对齐/颜色/背景，以及整段统一的行内颜色。
 * 落盘前把源块上的这些表现属性补回替换块，已有非默认样式优先保留。
 */
import { pickPersistedBlockProps } from "@/lib/export/markdown/blockPropsMarker";

const PRESENTATION_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "quoteListItem",
  "callout",
]);

type InlineColorStyles = {
  textColor?: string;
  backgroundColor?: string;
};

type PresentationBlock = {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown[];
  [key: string]: unknown;
};

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isStyledTextNode(
  node: unknown,
): node is { type?: string; text: string; styles?: Record<string, unknown> } {
  return (
    !!node &&
    typeof node === "object" &&
    typeof (node as { text?: unknown }).text === "string"
  );
}

function colorToken(value: unknown): string {
  return typeof value === "string" && value && value !== "default" ? value : "";
}

function walkInlineText(
  content: unknown,
  visit: (text: string, styles: Record<string, unknown>) => void,
): void {
  if (typeof content === "string") {
    if (content.length > 0) visit(content, {});
    return;
  }
  if (!Array.isArray(content)) return;
  for (const item of content) {
    if (typeof item === "string") {
      if (item.length > 0) visit(item, {});
      continue;
    }
    if (isStyledTextNode(item) && item.text.length > 0) {
      visit(item.text, item.styles ?? {});
      continue;
    }
    if (item && typeof item === "object" && Array.isArray((item as { content?: unknown }).content)) {
      walkInlineText((item as { content: unknown }).content, visit);
    }
  }
}

/** 源块全部文字节点共享同一非默认颜色时才继承，避免把局部高亮抹到整段。 */
export function collectUniformInlineColorStyles(
  content: unknown,
): InlineColorStyles | null {
  const textColors = new Set<string>();
  const backgroundColors = new Set<string>();
  let textNodes = 0;
  walkInlineText(content, (_text, styles) => {
    textNodes += 1;
    textColors.add(colorToken(styles.textColor));
    backgroundColors.add(colorToken(styles.backgroundColor));
  });
  if (textNodes === 0) return null;

  const next: InlineColorStyles = {};
  const colorValues = [...textColors].filter(Boolean);
  if (colorValues.length === 1 && !textColors.has("")) {
    next.textColor = colorValues[0];
  }
  const bgValues = [...backgroundColors].filter(Boolean);
  if (bgValues.length === 1 && !backgroundColors.has("")) {
    next.backgroundColor = bgValues[0];
  }
  return next.textColor || next.backgroundColor ? next : null;
}

function applyInlineColorStyles(
  content: unknown,
  styles: InlineColorStyles,
): unknown {
  if (!styles.textColor && !styles.backgroundColor) return content;

  const mergeStyles = (current: Record<string, unknown> | undefined) => {
    const next = { ...(current ?? {}) };
    if (!colorToken(next.textColor) && styles.textColor) {
      next.textColor = styles.textColor;
    }
    if (!colorToken(next.backgroundColor) && styles.backgroundColor) {
      next.backgroundColor = styles.backgroundColor;
    }
    return next;
  };

  if (typeof content === "string") {
    return content
      ? [{ type: "text", text: content, styles: mergeStyles({}) }]
      : content;
  }
  if (!Array.isArray(content)) return content;

  return content.map((item) => {
    if (typeof item === "string") {
      return item
        ? { type: "text", text: item, styles: mergeStyles({}) }
        : item;
    }
    if (isStyledTextNode(item)) {
      return { ...item, styles: mergeStyles(item.styles) };
    }
    if (item && typeof item === "object" && Array.isArray((item as { content?: unknown }).content)) {
      return {
        ...item,
        content: applyInlineColorStyles(
          (item as { content: unknown }).content,
          styles,
        ),
      };
    }
    return item;
  });
}

function mergeBlockProps(
  targetProps: Record<string, unknown> | undefined,
  sourceProps: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const inherited = pickPersistedBlockProps(sourceProps);
  const existing = pickPersistedBlockProps(targetProps);
  const merged: Record<string, unknown> = {
    ...(targetProps ?? {}),
    ...inherited,
    ...existing,
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function inheritOne(
  source: PresentationBlock | undefined,
  replacement: unknown,
): unknown {
  if (!replacement || typeof replacement !== "object") return replacement;
  if (!source || typeof source !== "object") return cloneValue(replacement);

  const next = cloneValue(replacement) as PresentationBlock;
  if (
    typeof next.type === "string" &&
    PRESENTATION_BLOCK_TYPES.has(next.type)
  ) {
    const props = mergeBlockProps(next.props, source.props);
    if (props) next.props = props;

    const inline = collectUniformInlineColorStyles(source.content);
    if (inline && next.content != null) {
      next.content = applyInlineColorStyles(next.content, inline);
    }
  }

  if (Array.isArray(next.children) && Array.isArray(source.children)) {
    next.children = inheritPresentationFromSource(
      source.children,
      next.children,
    ) as PresentationBlock["children"];
  }
  return next;
}

function pickSource(
  sources: PresentationBlock[],
  replacement: PresentationBlock,
  index: number,
  replacementCount: number,
): PresentationBlock {
  if (sources.length === replacementCount) {
    return sources[index] ?? sources[0]!;
  }
  if (sources.length === 1) return sources[0]!;

  const clamped = sources[Math.min(index, sources.length - 1)]!;
  if (clamped.type && clamped.type === replacement.type) return clamped;

  const sameType = sources.find((block) => block.type === replacement.type);
  return sameType ?? sources[0]!;
}

/**
 * 把源块的对齐、块级颜色/背景，以及整段统一的行内颜色补到替换块上。
 * 替换块上已有的非默认样式不覆盖。
 */
export function inheritPresentationFromSource(
  sourceBlocks: unknown[] | null | undefined,
  replacementBlocks: unknown[] | null | undefined,
): unknown[] {
  if (!Array.isArray(replacementBlocks) || replacementBlocks.length === 0) {
    return replacementBlocks ?? [];
  }
  if (!Array.isArray(sourceBlocks) || sourceBlocks.length === 0) {
    return replacementBlocks;
  }

  const sources = sourceBlocks.filter(
    (block): block is PresentationBlock =>
      !!block && typeof block === "object",
  );
  if (sources.length === 0) return replacementBlocks;

  return replacementBlocks.map((replacement, index) => {
    if (!replacement || typeof replacement !== "object") return replacement;
    const source = pickSource(
      sources,
      replacement as PresentationBlock,
      index,
      replacementBlocks.length,
    );
    return inheritOne(source, replacement);
  });
}
