import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { INLINE_BLOCK_TYPES, pickPersistedBlockProps, restorePersistedBlockProps, type MarkdownBlock, type PersistedBlockProps } from "./blockPropsProperties";
export { pickPersistedBlockProps, sanitizeCssColor } from "./blockPropsProperties";
export type { PersistedBlockProps } from "./blockPropsProperties";
export { LOCAL_BLOCK_PROPS_WRAPPER_STYLE, encodeLocalBlockPropsWrappers, wrapLocalBlockPropsMarkdown, unwrapLocalBlockPropsWrappers } from "./localBlockPropsWrappers";

const BLOCK_PROPS_MARKER = /^<!--[ \t]*goose-note:block-props=([^\s]+)[ \t]*-->/i;
const LEGACY_BLOCK_PROPS_MARKER = /^<!--[ \t]*goose-note:native-block-props=([^\s]+)[ \t]*-->/i;

function prependInlineMarker(content: unknown, marker: string): unknown[] {
  if (Array.isArray(content)) return [marker, ...content];
  if (typeof content === "string") return [marker, content];
  return [marker];
}

function stripInlineMarker(content: unknown): {
  encoded: string;
  content: unknown[];
  isCurrent: boolean;
} | null {
  if (!Array.isArray(content) || content.length === 0) return null;
  const first = content[0];
  const raw = typeof first === "string"
    ? first
    : first && typeof first === "object" && typeof (first as { text?: unknown }).text === "string"
      ? String((first as { text: string }).text)
      : "";
  const currentMatch = raw.match(BLOCK_PROPS_MARKER);
  const match = currentMatch ?? raw.match(LEGACY_BLOCK_PROPS_MARKER);
  if (!match) return null;
  const remainder = raw.replace(match[0], "");
  const next = [...content];
  if (remainder) {
    next[0] = typeof first === "string" ? remainder : { ...first, text: remainder };
  } else {
    next.shift();
  }
  return { encoded: match[1], content: next, isCurrent: Boolean(currentMatch) };
}

function decodeMarker(encoded: string, isCurrent: boolean): PersistedBlockProps | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
    if (isCurrent && parsed.v !== 1) return null;
    const metadata = restorePersistedBlockProps(parsed);
    // 只有实际恢复出白名单字段才消费标记，避免未知/未来版本内容被静默删除。
    return Object.keys(metadata).length > 0 ? metadata : null;
  } catch {
    return null;
  }
}

/** editor 的 lossless 比较将可恢复的旧命名空间归一为 v1 标记。 */
export function canonicalizeBlockPropsMarkers(markdown: string): string {
  return markdown.replace(
    /<!--[ \t]*goose-note:(native-)?block-props=([^\s]+)[ \t]*-->/gi,
    (source, legacyNamespace: string | undefined, encoded: string) => {
      try {
        const parsed = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
        if (!legacyNamespace && parsed.v !== 1) return source;
        const metadata = restorePersistedBlockProps(parsed);
        if (Object.keys(metadata).length === 0) return source;
        return `<!-- goose-note:block-props=${encodeURIComponent(JSON.stringify({ v: 1, ...metadata }))} -->`;
      } catch {
        return source;
      }
    },
  );
}

export function encodeBlockPropsMarkers(blocks: BlockNoteContent): BlockNoteContent {
  return (blocks as MarkdownBlock[]).map((block) => {
    const children = Array.isArray(block.children)
      ? encodeBlockPropsMarkers(block.children as BlockNoteContent)
      : undefined;
    const metadata = block.type && INLINE_BLOCK_TYPES.has(block.type)
      ? pickPersistedBlockProps(block.props)
      : {};
    return {
      ...block,
      ...(Object.keys(metadata).length > 0
        ? { content: prependInlineMarker(block.content, `<!-- goose-note:block-props=${encodeURIComponent(JSON.stringify({ v: 1, ...metadata }))} -->`) }
        : {}),
      ...(children ? { children } : {}),
    };
  }) as BlockNoteContent;
}

/** 恢复当前标记及 editor 旧标记；损坏内容保持原样，保证正文仍可打开。 */
export function restoreBlockPropsMarkers(blocks: BlockNoteContent): BlockNoteContent {
  return (blocks as MarkdownBlock[]).map((block) => {
    const children = Array.isArray(block.children)
      ? restoreBlockPropsMarkers(block.children as BlockNoteContent)
      : undefined;
    const encoded = stripInlineMarker(block.content);
    const metadata = encoded
      ? decodeMarker(encoded.encoded, encoded.isCurrent)
      : null;
    return {
      ...block,
      ...(metadata && encoded
        ? { props: { ...(block.props ?? {}), ...metadata }, content: encoded.content }
        : {}),
      ...(children ? { children } : {}),
    };
  }) as BlockNoteContent;
}
