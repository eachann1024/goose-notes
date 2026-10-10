export type MarkdownBlock = {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: MarkdownBlock[];
  [key: string]: unknown;
};

export type PersistedBlockProps = {
  textAlignment?: "left" | "center" | "right";
  textColor?: string;
  backgroundColor?: string;
};

// 这些名字与 ColorPicker 和 BlockNote 默认色板保持一致；同时允许常见、无副作用的
// CSS 色值，兼容已存在的自定义文档，但不接受可嵌入 url 等危险语法的任意字符串。
const KNOWN_COLORS = new Set([
  "default", "gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink",
]);
const SAFE_CSS_COLOR = /^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.%\s,/-]+\)|var\(--[A-Za-z0-9_-]+\)|[A-Za-z]{1,32})$/;
export const INLINE_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "callout",
]);

/**
 * 保留可安全嵌入 CSS 声明和 HTML style 属性的颜色值。
 * 不接受引号、分号、url() 等可逃逸属性边界的任意 CSS 片段。
 */
export function sanitizeCssColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim();
  return KNOWN_COLORS.has(color) || SAFE_CSS_COLOR.test(color) ? color : undefined;
}

export function restorePersistedBlockProps(props: Record<string, unknown>): PersistedBlockProps {
  const metadata: PersistedBlockProps = {};
  if (props.textAlignment === "left" || props.textAlignment === "center" || props.textAlignment === "right") {
    metadata.textAlignment = props.textAlignment;
  }
  const textColor = sanitizeCssColor(props.textColor);
  if (textColor) metadata.textColor = textColor;
  const backgroundColor = sanitizeCssColor(props.backgroundColor);
  if (backgroundColor) metadata.backgroundColor = backgroundColor;
  return metadata;
}

/** 只保留跨 Markdown 可恢复的、且编辑器可安全应用的块属性。 */
export function pickPersistedBlockProps(
  props: Record<string, unknown> | undefined,
): PersistedBlockProps {
  const metadata: PersistedBlockProps = {};
  if (props?.textAlignment === "center" || props?.textAlignment === "right") {
    metadata.textAlignment = props.textAlignment;
  }
  const textColor = sanitizeCssColor(props?.textColor);
  if (textColor && textColor !== "default") metadata.textColor = textColor;
  const backgroundColor = sanitizeCssColor(props?.backgroundColor);
  if (backgroundColor && backgroundColor !== "default") {
    metadata.backgroundColor = backgroundColor;
  }
  return metadata;
}
