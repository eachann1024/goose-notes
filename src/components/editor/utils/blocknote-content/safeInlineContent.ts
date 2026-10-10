import type { PartialBlock } from "@blocknote/core";
import { hasStructuredBlocks, simpleExtractText } from "./normalize";
import { sanitizePageMentionProps } from "@/components/editor/inline/pageMention";
import { isPlainObject } from "./safeContentProps";
function sanitizeStyles(value: unknown): Record<string, boolean | string> {
  if (!isPlainObject(value)) return {};
  const next: Record<string, boolean | string> = {};
  for (const [key, styleValue] of Object.entries(value)) {
    if (typeof styleValue === "boolean" || typeof styleValue === "string") {
      next[key] = styleValue;
    }
  }
  return next;
}

function sanitizeStyledText(value: unknown): {
  type: "text";
  text: string;
  styles: Record<string, boolean | string>;
} | null {
  if (typeof value === "string") {
    return { type: "text", text: value, styles: {} };
  }
  if (!isPlainObject(value)) return null;
  const text = value.text;
  if (typeof text !== "string") return null;
  return {
    type: "text",
    text,
    styles: sanitizeStyles(value.styles),
  };
}

function sanitizeLinkContent(content: unknown):
  | string
  | Array<{
      type: "text";
      text: string;
      styles: Record<string, boolean | string>;
    }> {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return simpleExtractText({ content });

  const nodes: Array<{
    type: "text";
    text: string;
    styles: Record<string, boolean | string>;
  }> = [];

  for (const item of content) {
    const text = sanitizeStyledText(item);
    if (text) {
      nodes.push(text);
      continue;
    }
    const fallbackText = simpleExtractText({ content: [item] });
    if (fallbackText) {
      nodes.push({ type: "text", text: fallbackText, styles: {} });
    }
  }

  return nodes.length > 0 ? nodes : "";
}

function sanitizeInlineArray(
  content: unknown[],
): NonNullable<PartialBlock["content"]> {
  const nodes: unknown[] = [];

  for (const item of content) {
    if (typeof item === "string") {
      nodes.push(item);
      continue;
    }

    if (!isPlainObject(item)) continue;

    if (item.type === "link") {
      const href =
        typeof item.href === "string"
          ? item.href
          : typeof item.url === "string"
            ? item.url
            : "";
      const linkContent = sanitizeLinkContent(item.content);
      const text =
        typeof linkContent === "string"
          ? linkContent
          : linkContent.map((node) => node.text).join("");
      if (href || text) {
        nodes.push({
          type: "link",
          href,
          content: linkContent,
        });
      }
      continue;
    }

    if (item.type === "pageMention") {
      const mention = sanitizePageMentionProps(item);
      if (mention) {
        nodes.push({
          type: "pageMention",
          props: mention,
        });
      }
      continue;
    }

    const text = sanitizeStyledText(item);
    if (text) {
      nodes.push(text);
      continue;
    }

    const fallbackText = simpleExtractText({ content: [item] });
    if (fallbackText) nodes.push(fallbackText);
  }

  return nodes.length > 0
    ? (nodes as NonNullable<PartialBlock["content"]>)
    : "";
}

export function normalizeInlineContent(
  content: unknown,
): PartialBlock["content"] {
  if (typeof content === "string") return content;
  if (Array.isArray(content) && !hasStructuredBlocks(content)) {
    return sanitizeInlineArray(content);
  }
  return simpleExtractText({ content });
}
