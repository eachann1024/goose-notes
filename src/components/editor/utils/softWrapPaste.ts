import { Fragment, Slice } from "@tiptap/pm/model";
import { parseInlineMarkdown } from "@/lib/export/markdown/parse/inline";
import {
  looksLikeMarkdownFragment,
  normalizeClipboardLineEndings,
} from "./clipboard";
import { splitPlainTextPasteLines } from "./multilinePaste";

export type SoftWrapInlineItem =
  | string
  | { type: "hardBreak" }
  | { type: "text"; text: string; styles?: Record<string, unknown> }
  | { type: "link"; href: string; content: SoftWrapInlineItem[] }
  | { type: "pageMention"; props?: Record<string, unknown> };

type SoftWrapEditor = {
  insertInlineContent?: (content: unknown) => void;
  prosemirrorState: {
    schema: {
      text: (text: string, marks?: readonly unknown[]) => unknown;
      nodes: Record<string, { create: (attrs?: unknown, content?: unknown) => unknown }>;
      marks: Record<
        string,
        {
          create: (attrs?: Record<string, unknown>) => unknown;
          spec?: { attrs?: Record<string, unknown> };
        }
      >;
    };
    tr: { replaceSelection: (slice: Slice) => { scrollIntoView: () => unknown } };
  };
  prosemirrorView: { dispatch: (tr: unknown) => void };
};

function appendInlineContent(
  result: SoftWrapInlineItem[],
  content: unknown,
) {
  if (typeof content === "string") {
    if (content) result.push(content);
    return;
  }
  if (!Array.isArray(content)) return;
  for (const item of content) {
    if (typeof item === "string") {
      if (item) result.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === "hardBreak") {
      result.push({ type: "hardBreak" });
      continue;
    }
    if (rec.type === "link") {
      const href =
        typeof rec.href === "string"
          ? rec.href
          : typeof rec.url === "string"
            ? rec.url
            : "";
      const inner: SoftWrapInlineItem[] = [];
      appendInlineContent(inner, rec.content);
      result.push({ type: "link", href, content: inner });
      continue;
    }
    if (rec.type === "pageMention") {
      result.push({
        type: "pageMention",
        props:
          rec.props && typeof rec.props === "object"
            ? (rec.props as Record<string, unknown>)
            : rec,
      });
      continue;
    }
    if (typeof rec.text === "string") {
      result.push({
        type: "text",
        text: rec.text,
        styles:
          rec.styles && typeof rec.styles === "object"
            ? (rec.styles as Record<string, unknown>)
            : {},
      });
    }
  }
}

/** 把解析出的块压成同一 textblock 的 inline + hardBreak，避免拆出 callout/quote。 */
export function flattenParsedBlocksToSoftWrapInline(
  blocks: unknown[],
): SoftWrapInlineItem[] {
  const result: SoftWrapInlineItem[] = [];

  const walk = (list: unknown[]) => {
    for (const block of list) {
      if (!block || typeof block !== "object") continue;
      const rec = block as { content?: unknown; children?: unknown[] };
      if (result.length > 0) result.push({ type: "hardBreak" });
      appendInlineContent(result, rec.content);
      if (Array.isArray(rec.children) && rec.children.length > 0) {
        walk(rec.children);
      }
    }
  };

  walk(blocks);
  return result;
}

/** 按行解析 inline markdown，保留 `**粗体**` 与换行，不把 `2.` 变成有序列表。 */
export function buildSoftWrapInlineFromMarkdown(
  text: string,
): SoftWrapInlineItem[] {
  const lines =
    splitPlainTextPasteLines(text) ?? [normalizeClipboardLineEndings(text)];
  const result: SoftWrapInlineItem[] = [];
  lines.forEach((line, index) => {
    if (index > 0) result.push({ type: "hardBreak" });
    result.push(...(parseInlineMarkdown(line) as SoftWrapInlineItem[]));
  });
  return result;
}

export function htmlHasInlineFormatting(html: string): boolean {
  return /<\s*(strong|b|em|i|u|s|del|code|a|span)\b/i.test(html || "");
}

export function hasStyledSoftWrapItems(items: SoftWrapInlineItem[]): boolean {
  return items.some((item) => {
    if (typeof item === "string") return false;
    if (item.type === "hardBreak") return false;
    if (item.type === "link") return true;
    if (item.type === "pageMention") return true;
    const styles = item.styles ?? {};
    return Object.values(styles).some((value) => value != null && value !== false);
  });
}

function marksFromStyles(
  schema: SoftWrapEditor["prosemirrorState"]["schema"],
  styles: Record<string, unknown> | undefined,
): unknown[] {
  if (!styles) return [];
  const marks: unknown[] = [];
  for (const [name, value] of Object.entries(styles)) {
    if (value == null || value === false) continue;
    const markType = schema.marks[name];
    if (!markType) continue;
    try {
      if (value === true) {
        marks.push(markType.create());
        continue;
      }
      if (typeof value !== "string") continue;
      const attrs = markType.spec?.attrs ?? {};
      if ("stringValue" in attrs) {
        marks.push(markType.create({ stringValue: value }));
      } else if ("color" in attrs) {
        marks.push(markType.create({ color: value }));
      } else {
        marks.push(markType.create());
      }
    } catch {
      /* 跳过无法创建的 mark */
    }
  }
  return marks;
}

function inlineItemsToPmNodes(
  schema: SoftWrapEditor["prosemirrorState"]["schema"],
  items: SoftWrapInlineItem[],
): unknown[] {
  const nodes: unknown[] = [];
  const hardBreakType = schema.nodes.hardBreak;
  const linkType = schema.nodes.link;

  for (const item of items) {
    if (typeof item === "string") {
      if (item) nodes.push(schema.text(item));
      continue;
    }
    if (item.type === "hardBreak") {
      if (hardBreakType) nodes.push(hardBreakType.create());
      continue;
    }
    if (item.type === "link") {
      const inner = inlineItemsToPmNodes(schema, item.content);
      if (linkType && inner.length > 0) {
        nodes.push(linkType.create({ href: item.href }, inner));
      } else {
        nodes.push(...inner);
      }
      continue;
    }
    if (item.type === "pageMention") {
      const mentionType = schema.nodes.pageMention;
      if (mentionType) {
        nodes.push(mentionType.create(item.props ?? {}));
      }
      continue;
    }
    if (!item.text) continue;
    const marks = marksFromStyles(schema, item.styles);
    nodes.push(schema.text(item.text, marks));
  }
  return nodes;
}

function dispatchInlineSlice(editor: SoftWrapEditor, nodes: unknown[]) {
  const pmState = editor.prosemirrorState;
  const slice = new Slice(Fragment.fromArray(nodes as never[]), 0, 0);
  editor.prosemirrorView.dispatch(
    pmState.tr.replaceSelection(slice).scrollIntoView(),
  );
}

/** BlockNote 把文本里的 `\n` 转成 hardBreak，不能传 `{ type: "hardBreak" }`。 */
export function toInsertableInlineContent(
  items: SoftWrapInlineItem[],
): unknown[] {
  const result: unknown[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      result.push(item);
      continue;
    }
    if (item.type === "hardBreak") {
      result.push("\n");
      continue;
    }
    if (item.type === "link") {
      result.push({
        type: "link",
        href: item.href,
        content: toInsertableInlineContent(item.content),
      });
      continue;
    }
    if (item.type === "pageMention") {
      result.push({
        type: "pageMention",
        props: item.props ?? {},
      });
      continue;
    }
    result.push({
      type: "text",
      text: item.text,
      styles: item.styles ?? {},
    });
  }
  return result;
}

export function insertSoftWrappedInline(
  editor: SoftWrapEditor,
  items: SoftWrapInlineItem[],
) {
  if (items.length === 0) return;
  const inline = toInsertableInlineContent(items);
  if (typeof editor.insertInlineContent === "function") {
    editor.insertInlineContent(inline);
    return;
  }
  const nodes = inlineItemsToPmNodes(editor.prosemirrorState.schema, items);
  dispatchInlineSlice(editor, nodes);
}

export function insertSoftWrappedLines(editor: SoftWrapEditor, text: string) {
  const lines = normalizeClipboardLineEndings(text).split("\n");
  const items: SoftWrapInlineItem[] = [];
  lines.forEach((line, index) => {
    if (index > 0) items.push({ type: "hardBreak" });
    if (line) items.push(line);
  });
  insertSoftWrappedInline(editor, items);
}

export function buildSoftWrapPasteInline(input: {
  plainText: string;
  parsedHtmlBlocks?: unknown[] | null;
}): SoftWrapInlineItem[] {
  const htmlInline = Array.isArray(input.parsedHtmlBlocks)
    ? flattenParsedBlocksToSoftWrapInline(input.parsedHtmlBlocks)
    : [];
  if (htmlInline.length > 0 && hasStyledSoftWrapItems(htmlInline)) {
    return htmlInline;
  }
  if (looksLikeMarkdownFragment(input.plainText)) {
    const markdownInline = buildSoftWrapInlineFromMarkdown(input.plainText);
    if (markdownInline.length > 0) return markdownInline;
  }
  if (htmlInline.length > 0) return htmlInline;
  return [];
}
