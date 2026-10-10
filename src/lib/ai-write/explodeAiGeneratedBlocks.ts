/**
 * AI 落盘后的确定性块结构：不依赖模型有没有输出标准 Markdown。
 * 每行独立成块；勾选外观一律变成可点击的 checkListItem。
 */
import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";

const ATOMIC_BLOCK_TYPES = new Set([
  "codeBlock",
  "table",
  "image",
  "video",
  "file",
  "audio",
  "divider",
]);

/** 容器块：只拆 children，不把自身正文打成多张卡片。 */
const CONTAINER_BLOCK_TYPES = new Set(["callout", "toggleListItem"]);

const LIST_BLOCK_TYPES = new Set([
  "checkListItem",
  "bulletListItem",
  "numberedListItem",
]);

import { classifyAiLineText } from "./aiLineStructure";
import {
  cloneValue,
  inlinePlainText,
  splitContentLines,
  stripLeadingChars,
} from "./aiInlineLines";
export {
  classifyAiLineText,
  rewriteAiStructureLine,
  type AiLineClass,
} from "./aiLineStructure";

function presentationProps(props: Record<string, unknown> | undefined) {
  const next: Record<string, unknown> = {};
  if (!props) return next;
  for (const key of ["textAlignment", "textColor", "backgroundColor"]) {
    if (key in props) next[key] = props[key];
  }
  return next;
}

function isCheckedProp(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeLineContent(content: unknown): unknown {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content ?? "";
  if (content.length === 0) return "";
  if (content.length === 1 && typeof content[0] === "string") return content[0];
  return content;
}

function isEmptyLineContent(content: unknown): boolean {
  return inlinePlainText(content).trim().length === 0;
}

function explodeChildren(children: unknown): PartialBlock[] | undefined {
  if (!Array.isArray(children) || children.length === 0) return undefined;
  const exploded = explodeAiGeneratedBlocks(children as BlockNoteContent);
  return exploded.length > 0 ? exploded : undefined;
}

function makeBlock(
  type: string,
  content: unknown,
  props: Record<string, unknown> | undefined,
  children?: PartialBlock[],
): PartialBlock | null {
  if (
    LIST_BLOCK_TYPES.has(type) &&
    isEmptyLineContent(content) &&
    !children?.length
  ) {
    return null;
  }
  const block: Record<string, unknown> = {
    type,
    content: normalizeLineContent(content),
  };
  if (props && Object.keys(props).length > 0) block.props = props;
  if (children?.length) block.children = children;
  return block as PartialBlock;
}

function blockFromLine(
  lineContent: unknown,
  inheritedType: string,
  inheritedProps: Record<string, unknown> | undefined,
  children?: PartialBlock[],
): PartialBlock | null {
  const text = inlinePlainText(lineContent);
  const classified = classifyAiLineText(text);
  const baseProps = presentationProps(inheritedProps);

  if (classified?.kind === "check") {
    return makeBlock(
      "checkListItem",
      stripLeadingChars(lineContent, classified.prefixLength),
      { ...baseProps, checked: classified.checked },
      children,
    );
  }
  if (classified?.kind === "bullet") {
    return makeBlock(
      "bulletListItem",
      stripLeadingChars(lineContent, classified.prefixLength),
      baseProps,
      children,
    );
  }
  if (classified?.kind === "numbered") {
    const props = { ...baseProps };
    if (classified.start !== 1) props.start = classified.start;
    return makeBlock(
      "numberedListItem",
      stripLeadingChars(lineContent, classified.prefixLength),
      props,
      children,
    );
  }

  if (inheritedType === "checkListItem") {
    return makeBlock(
      "checkListItem",
      lineContent,
      { ...baseProps, checked: isCheckedProp(inheritedProps?.checked) },
      children,
    );
  }
  if (inheritedType === "numberedListItem") {
    const props = { ...baseProps };
    const start = inheritedProps?.start;
    if (typeof start === "number" && start !== 1) props.start = start;
    return makeBlock("numberedListItem", lineContent, props, children);
  }
  if (inheritedType === "heading") {
    const props = { ...baseProps };
    const level = inheritedProps?.level;
    if (typeof level === "number") props.level = level;
    return makeBlock("heading", lineContent, props, children);
  }
  return makeBlock(
    inheritedType || "paragraph",
    lineContent,
    baseProps,
    children,
  );
}

function explodeOne(block: unknown): PartialBlock[] {
  if (!block || typeof block !== "object") return [];
  const source = block as {
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: unknown;
  };
  const type = typeof source.type === "string" ? source.type : "paragraph";
  const children = explodeChildren(source.children);

  if (ATOMIC_BLOCK_TYPES.has(type) || CONTAINER_BLOCK_TYPES.has(type)) {
    const next = cloneValue(source) as PartialBlock;
    if (children) (next as { children?: PartialBlock[] }).children = children;
    return [next];
  }

  const lines = splitContentLines(source.content);
  const meaningful = lines.filter((line, index) => {
    if (!isEmptyLineContent(line)) return true;
    return type === "paragraph" && index > 0 && index < lines.length - 1;
  });

  if (meaningful.length === 0) {
    if (children?.length) {
      const shell = makeBlock(type, "", source.props, children);
      return shell ? [shell] : children;
    }
    if (LIST_BLOCK_TYPES.has(type)) return [];
    const empty = makeBlock(type || "paragraph", "", source.props);
    return empty ? [empty] : [];
  }

  if (meaningful.length === 1) {
    const only = blockFromLine(meaningful[0], type, source.props, children);
    return only ? [only] : (children ?? []);
  }

  return meaningful.flatMap((line, index) => {
    const isLast = index === meaningful.length - 1;
    const next = blockFromLine(
      line,
      type,
      source.props,
      isLast ? children : undefined,
    );
    return next ? [next] : [];
  });
}

function assignNumberedStarts(blocks: PartialBlock[]): PartialBlock[] {
  let inRun = false;
  return blocks.map((block) => {
    const next = { ...block } as PartialBlock & {
      props?: Record<string, unknown>;
      children?: PartialBlock[];
    };
    if (Array.isArray(next.children) && next.children.length > 0) {
      next.children = assignNumberedStarts(next.children);
    }
    if (next.type !== "numberedListItem") {
      inRun = false;
      return next;
    }
    const start = next.props?.start;
    const numericStart = typeof start === "number" ? start : Number(start);
    const props = { ...(next.props ?? {}) };
    if (!inRun && Number.isFinite(numericStart) && numericStart !== 1) {
      props.start = numericStart;
    } else {
      delete props.start;
    }
    next.props = Object.keys(props).length > 0 ? props : undefined;
    inRun = true;
    return next;
  });
}

export function explodeAiGeneratedBlocks(
  blocks: unknown[] | null | undefined,
): BlockNoteContent {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  return assignNumberedStarts(blocks.flatMap(explodeOne));
}
