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
]);

/** 容器块：只拆 children，不把自身正文打成多张卡片。 */
const CONTAINER_BLOCK_TYPES = new Set(["callout", "toggleListItem"]);

const LIST_BLOCK_TYPES = new Set([
  "checkListItem",
  "bulletListItem",
  "numberedListItem",
]);

const CHECKED_EMOJI = /^(?:✅|☑\uFE0F?|✔\uFE0F?|✓|☒)\s*/u;
const UNCHECKED_EMOJI = /^(?:☐|□|⬜|🔲)\s*/u;

export type AiLineClass =
  | { kind: "check"; checked: boolean; rest: string; prefixLength: number }
  | { kind: "bullet"; rest: string; prefixLength: number }
  | { kind: "numbered"; start: number; rest: string; prefixLength: number };

export function classifyAiLineText(text: string): AiLineClass | null {
  const lead = text.match(/^\s*/)?.[0].length ?? 0;
  const body = text.slice(lead);

  const taskPrefix = body.match(/^(?:[-*+]\s+)?\[([ xX])\]\s*/);
  if (taskPrefix) {
    return {
      kind: "check",
      checked: taskPrefix[1].toLowerCase() === "x",
      rest: body.slice(taskPrefix[0].length),
      prefixLength: lead + taskPrefix[0].length,
    };
  }

  const fullwidthTask = body.match(/^(?:[-*+]\s+)?【\s*([xX])?\s*】\s*/);
  if (fullwidthTask) {
    return {
      kind: "check",
      checked: (fullwidthTask[1] ?? "").toLowerCase() === "x",
      rest: body.slice(fullwidthTask[0].length),
      prefixLength: lead + fullwidthTask[0].length,
    };
  }

  const listMark = body.match(/^[-*+]\s+/);
  const afterList = listMark ? body.slice(listMark[0].length) : body;
  const listMarkLen = listMark?.[0].length ?? 0;

  const checkedEmoji = afterList.match(CHECKED_EMOJI);
  if (checkedEmoji) {
    return {
      kind: "check",
      checked: true,
      rest: afterList.slice(checkedEmoji[0].length),
      prefixLength: lead + listMarkLen + checkedEmoji[0].length,
    };
  }

  const uncheckedEmoji = afterList.match(UNCHECKED_EMOJI);
  if (uncheckedEmoji) {
    return {
      kind: "check",
      checked: false,
      rest: afterList.slice(uncheckedEmoji[0].length),
      prefixLength: lead + listMarkLen + uncheckedEmoji[0].length,
    };
  }

  // `1. foo` 要有空格；`1.5` / `2024.8.28` 不能当成有序列表。
  // `1)` / `1、` / `1。` 允许无空格，对齐中文输入习惯。
  const numbered = body.match(/^(\d+)(?:\.\s+|[)、）。]\s*)/);
  if (numbered) {
    return {
      kind: "numbered",
      start: Number.parseInt(numbered[1], 10),
      rest: body.slice(numbered[0].length),
      prefixLength: lead + numbered[0].length,
    };
  }

  const bullet = body.match(/^(?:[-*+]|[•·])\s+/);
  if (bullet) {
    return {
      kind: "bullet",
      rest: body.slice(bullet[0].length),
      prefixLength: lead + bullet[0].length,
    };
  }

  return null;
}

/** 把伪列表/待办行改写成解析器能认的 Markdown。围栏外逐行调用。 */
export function rewriteAiStructureLine(line: string): string {
  const classified = classifyAiLineText(line);
  const indent = line.match(/^\s*/)?.[0] ?? "";
  if (!classified) return line;
  if (classified.kind === "check") {
    return `${indent}- [${classified.checked ? "x" : " "}] ${classified.rest}`;
  }
  if (classified.kind === "bullet") {
    return `${indent}- ${classified.rest}`;
  }
  return `${indent}${classified.start}. ${classified.rest}`;
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isHardBreak(item: unknown): boolean {
  return (
    !!item &&
    typeof item === "object" &&
    (item as { type?: unknown }).type === "hardBreak"
  );
}

function inlinePlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const value = item as Record<string, unknown>;
      if (isHardBreak(value)) return "\n";
      if (typeof value.text === "string") return value.text;
      return inlinePlainText(value.content);
    })
    .join("");
}

function splitInlineArray(content: unknown[]): unknown[][] {
  const lines: unknown[][] = [[]];
  const nextLine = () => lines.push([]);

  for (const rawItem of content) {
    if (isHardBreak(rawItem)) {
      nextLine();
      continue;
    }
    if (typeof rawItem === "string") {
      const parts = rawItem.split("\n");
      parts.forEach((text, index) => {
        if (text) lines[lines.length - 1].push(text);
        if (index < parts.length - 1) nextLine();
      });
      continue;
    }
    if (!rawItem || typeof rawItem !== "object") {
      lines[lines.length - 1].push(cloneValue(rawItem));
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    if (item.type === "link" && Array.isArray(item.content)) {
      const linkLines = splitInlineArray(item.content);
      linkLines.forEach((line, index) => {
        if (line.length > 0) {
          lines[lines.length - 1].push({
            ...cloneValue(item),
            content: line,
          });
        }
        if (index < linkLines.length - 1) nextLine();
      });
      continue;
    }

    if (typeof item.text !== "string" || !item.text.includes("\n")) {
      lines[lines.length - 1].push(cloneValue(item));
      continue;
    }

    const parts = item.text.split("\n");
    parts.forEach((text, index) => {
      if (text) lines[lines.length - 1].push({ ...cloneValue(item), text });
      if (index < parts.length - 1) nextLine();
    });
  }

  return lines;
}

function splitContentLines(content: unknown): unknown[] {
  if (typeof content === "string") return content.split("\n");
  if (!Array.isArray(content)) return content == null ? [""] : [content];
  return splitInlineArray(content);
}

function stripLeadingChars(content: unknown, count: number): unknown {
  return stripLeadingCharsTracked(content, count).value;
}

function stripLeadingCharsTracked(
  content: unknown,
  count: number,
): { value: unknown; remaining: number } {
  if (count <= 0) return { value: content, remaining: 0 };
  if (typeof content === "string") {
    if (content.length <= count) {
      return { value: "", remaining: count - content.length };
    }
    return { value: content.slice(count), remaining: 0 };
  }
  if (!Array.isArray(content)) return { value: content, remaining: count };

  let remaining = count;
  const out: unknown[] = [];
  for (const raw of content) {
    if (remaining <= 0) {
      out.push(raw);
      continue;
    }
    if (typeof raw === "string") {
      const next = stripLeadingCharsTracked(raw, remaining);
      remaining = next.remaining;
      if (typeof next.value === "string" && next.value.length > 0) {
        out.push(next.value);
      }
      continue;
    }
    if (raw && typeof raw === "object") {
      const item = raw as Record<string, unknown>;
      if (typeof item.text === "string") {
        const next = stripLeadingCharsTracked(item.text, remaining);
        remaining = next.remaining;
        if (typeof next.value === "string" && next.value.length > 0) {
          out.push({ ...item, text: next.value });
        }
        continue;
      }
      if (Array.isArray(item.content)) {
        const next = stripLeadingCharsTracked(item.content, remaining);
        remaining = next.remaining;
        if (inlinePlainText(next.value).length > 0) {
          out.push({ ...item, content: next.value });
        }
        continue;
      }
    }
    out.push(raw);
  }
  return { value: out, remaining };
}

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
  if (LIST_BLOCK_TYPES.has(type) && isEmptyLineContent(content) && !children?.length) {
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
  return makeBlock(inheritedType || "paragraph", lineContent, baseProps, children);
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
    return only ? [only] : children ?? [];
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
