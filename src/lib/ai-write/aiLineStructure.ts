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
