import type {
  AiFileReferenceAttrs,
  AiSkillCommandAttrs,
} from "@/components/editor/ai/composer/referenceLookup";
import {
  formatSelectionQuotePromptLabel,
  type AiSelectionQuoteAttrs,
} from "@/components/editor/ai/composer/selectionQuote";

export type UserMessageSegment =
  | { type: "text"; text: string }
  | { type: "reference"; reference: AiFileReferenceAttrs; key: string }
  | { type: "skill"; skill: AiSkillCommandAttrs; key: string }
  | { type: "selectionQuote"; quote: AiSelectionQuoteAttrs; key: string };

type SegmentNeedle =
  | {
      kind: "reference";
      reference: AiFileReferenceAttrs;
      needle: string;
    }
  | {
      kind: "skill";
      skill: AiSkillCommandAttrs;
      needle: string;
    }
  | {
      kind: "selectionQuote";
      quote: AiSelectionQuoteAttrs;
      needle: string;
    };

/** 本地 Skill 命名：小写 kebab-case，与 normalizeSkillName 对齐。 */
const INFERRED_SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSlashCommandBoundary(text: string, slashIndex: number): boolean {
  if (slashIndex <= 0) return true;
  return /[\s\n\u200B\uFEFF]/.test(text[slashIndex - 1]!);
}

/** `/name` 后若仍是标识符或路径续段，则不是独立 skill token。 */
function isSlashCommandTokenEnd(text: string, afterName: number): boolean {
  if (afterName >= text.length) return true;
  return !/[A-Za-z0-9_/\-]/.test(text[afterName]!);
}

function findNeedleIndex(
  text: string,
  needle: string,
  from: number,
  requireSlashBoundary: boolean,
): number {
  let start = from;
  while (start <= text.length - needle.length) {
    const index = text.indexOf(needle, start);
    if (index === -1) return -1;
    if (!requireSlashBoundary) return index;
    if (
      isSlashCommandBoundary(text, index) &&
      isSlashCommandTokenEnd(text, index + needle.length)
    ) {
      return index;
    }
    start = index + 1;
  }
  return -1;
}

/**
 * metadata.skills 为空时，只把「像 slash 指令」的 `/name` 生成 skill needles：
 * 词首 `/` + 小写 kebab-case，且不是路径续段。
 * 正文里的 `/Profile`、`/usr/bin` 当普通文本，避免误渲染成 chip。
 */
export function inferSkillsFromDisplayText(
  text: string,
): AiSkillCommandAttrs[] {
  const re = /\/([a-z0-9]+(?:-[a-z0-9]+)*)/g;
  const seen = new Set<string>();
  const result: AiSkillCommandAttrs[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const slashIndex = match.index;
    const afterName = slashIndex + match[0].length;
    if (!isSlashCommandBoundary(text, slashIndex)) continue;
    if (!isSlashCommandTokenEnd(text, afterName)) continue;
    const rawName = match[1];
    if (!INFERRED_SKILL_NAME.test(rawName)) continue;
    if (seen.has(rawName)) continue;
    seen.add(rawName);
    result.push({ name: rawName });
  }
  return result;
}

/**
 * 把 displayText 里的 `@标题` / `/${name}` 拆成与输入框一致的内联 chip 片段。
 * 同位置优先更长 needle；@ 与 / 互不吞字符。
 * skills 为空时只回退扫词首的小写 `/name`，不把路径当 skill。
 */
export function buildUserMessageSegments(
  text: string,
  references: AiFileReferenceAttrs[],
  skills: AiSkillCommandAttrs[] = [],
  selectionQuotes: AiSelectionQuoteAttrs[] = [],
): UserMessageSegment[] {
  if (!text) return [];

  const effectiveSkills =
    skills.length > 0 ? skills : inferSkillsFromDisplayText(text);

  const needles: SegmentNeedle[] = [
    ...references.map((reference) => ({
      kind: "reference" as const,
      reference,
      needle: `@${reference.titleSnapshot}`,
    })),
    ...effectiveSkills.map((skill) => ({
      kind: "skill" as const,
      skill,
      needle: `/${skill.name}`,
    })),
    ...selectionQuotes.map((quote) => ({
      kind: "selectionQuote" as const,
      quote,
      needle: formatSelectionQuotePromptLabel(quote),
    })),
  ].filter((item) => item.needle.length > 1);

  if (needles.length === 0) return [{ type: "text", text }];

  const segments: UserMessageSegment[] = [];
  let cursor = 0;
  let refOccurrence = 0;
  let skillOccurrence = 0;
  let quoteOccurrence = 0;

  while (cursor < text.length) {
    let match: {
      index: number;
      length: number;
      needle: SegmentNeedle;
    } | null = null;

    for (const item of needles) {
      const index = findNeedleIndex(
        text,
        item.needle,
        cursor,
        item.kind === "skill",
      );
      if (index === -1) continue;
      if (
        !match ||
        index < match.index ||
        (index === match.index && item.needle.length > match.length)
      ) {
        match = { index, length: item.needle.length, needle: item };
      }
    }

    if (!match) {
      segments.push({ type: "text", text: text.slice(cursor) });
      break;
    }

    if (match.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, match.index) });
    }

    if (match.needle.kind === "reference") {
      segments.push({
        type: "reference",
        reference: match.needle.reference,
        key: `${match.needle.reference.pageId}-${refOccurrence++}`,
      });
    } else if (match.needle.kind === "skill") {
      segments.push({
        type: "skill",
        skill: match.needle.skill,
        key: `skill-${match.needle.skill.name}-${skillOccurrence++}`,
      });
    } else {
      segments.push({
        type: "selectionQuote",
        quote: match.needle.quote,
        key: `quote-${match.needle.quote.pageId}-${quoteOccurrence++}`,
      });
    }
    cursor = match.index + match.length;
  }

  return segments;
}
