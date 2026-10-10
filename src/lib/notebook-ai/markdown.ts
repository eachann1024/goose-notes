/**
 * markdown.ts — AI 输出 markdown 归一化 + 页面内容构建
 *
 * batch-plan（工具最终落盘）与 liveWriter.ts（流式中间帧）共用，
 * 保证两条写入路径对模型输出做完全一致的清洗。
 */
import { importMarkdownFragment } from "@/lib/export/markdown/parse";
import { restoreBlockPropsMarkers } from "@/lib/export/markdown/blockPropsMarker";
import {
  normalizePageContent,
  titleHeadingBlock,
  emptyBlock,
} from "@/components/editor/utils/blocknote-content";
import { explodeAiGeneratedBlocks } from "@/lib/ai-write/explodeAiGeneratedBlocks";
import { normalizeGeneratedStructureMarkdown } from "@/lib/ai-write/blockStructureValidation";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { JSONContent } from "@/types";

/** 裸任务标记行：`[x] 内容` / `[ ] 内容`（缺 `- ` 前缀，无法解析成勾选块） */
const BARE_TASK_PREFIX = /^(\s*)\[([ xX])\]\s+/;

/** 列表行（任务 / 无序 / 有序） */
const LIST_LINE = /^\s*(?:-\s+\[[ xX]\]\s+|[-*+]\s+\S|\d+\.\s+\S)/;

const TABLE_LINE = /^\s*\|/;
const QUOTE_LINE = /^\s{0,3}>/;
const HEADING_LINE = /^\s{0,3}#{1,6}\s+\S/;
const HR_LINE = /^(\s{0,3})([-*_])\s*(?:\2\s*){2,}$/;
const SETEXT_LINE = /^(?:=+|-+)\s*$/;

function fixBareTask(line: string): string {
  return line.replace(BARE_TASK_PREFIX, "$1- [$2] ");
}

type FenceState = { char: "`" | "~"; length: number } | null;

function matchFence(line: string): { char: "`" | "~"; length: number } | null {
  const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
  if (!fenceMatch) return null;
  const marker = fenceMatch[1];
  return { char: marker[0] as "`" | "~", length: marker.length };
}

function toggleFence(state: FenceState, line: string): FenceState | "keep" {
  const fence = matchFence(line);
  if (!fence) return "keep";
  if (!state) return fence;
  if (state.char === fence.char && fence.length >= state.length) return null;
  return "keep";
}

function isKeepTogetherLine(line: string): boolean {
  return (
    LIST_LINE.test(line) ||
    TABLE_LINE.test(line) ||
    QUOTE_LINE.test(line) ||
    HEADING_LINE.test(line) ||
    HR_LINE.test(line.trim()) ||
    SETEXT_LINE.test(line.trim())
  );
}

/**
 * 普通正文相邻行拆成独立段落：笔记里 Enter 是新块，不能把多行合成一段。
 * 列表 / 表格 / 引用 / 标题保持原样紧邻，避免拆坏结构。
 */
function separateParagraphLines(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let fence: FenceState = null;
  let prevParagraph = false;

  for (const raw of lines) {
    const toggled = toggleFence(fence, raw);
    if (toggled !== "keep") {
      fence = toggled;
      out.push(raw);
      prevParagraph = false;
      continue;
    }
    if (fence) {
      out.push(raw);
      prevParagraph = false;
      continue;
    }
    if (!raw.trim()) {
      out.push(raw);
      prevParagraph = false;
      continue;
    }
    if (isKeepTogetherLine(raw)) {
      out.push(raw);
      prevParagraph = false;
      continue;
    }
    if (prevParagraph) out.push("");
    out.push(raw);
    prevParagraph = true;
  }

  return out.join("\n");
}

/**
 * 只清洗伪标记 / 裸任务 / 列表空行，不插入段落空行。
 * 给 search_replace 对齐用，避免把一段硬换行拆碎成多个 hunk。
 */
export function normalizeAiMarkdownForDiff(markdown: string): string {
  return cleanAiMarkdown(markdown, { separateParagraphs: false });
}

/**
 * 模型输出兜底归一化（fenced 代码块内部原样保留）：
 * 1. 伪待办 / 伪列表标记改写成标准 Markdown；
 * 2. 裸 `[x] 内容` 行补 `- ` 前缀，落页后才能成为勾选块；
 * 3. 删除相邻列表项之间的单个空行——loose list 会被解析成 spacer
 *    段落，页面里行距被拉大一倍；
 * 4. 连续普通正文行拆成独立段落，避免整篇合成一个 block。
 */
function cleanAiMarkdown(
  markdown: string,
  options: { separateParagraphs: boolean },
): string {
  const structured = normalizeGeneratedStructureMarkdown(markdown);
  const lines = structured.split("\n");
  const out: string[] = [];
  let fence: FenceState = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const toggled = toggleFence(fence, raw);
    if (toggled !== "keep") {
      fence = toggled;
      out.push(raw);
      continue;
    }
    if (fence) {
      out.push(raw);
      continue;
    }

    if (!raw.trim()) {
      const prev = out[out.length - 1] ?? "";
      const next = fixBareTask(lines[i + 1] ?? "");
      if (LIST_LINE.test(prev) && LIST_LINE.test(next)) {
        continue;
      }
      out.push(raw);
      continue;
    }

    out.push(fixBareTask(raw));
  }

  const joined = out.join("\n");
  return options.separateParagraphs ? separateParagraphLines(joined) : joined;
}

export function normalizeAiMarkdown(markdown: string): string {
  return cleanAiMarkdown(markdown, { separateParagraphs: true });
}

/** 解析 AI markdown 为独立块，并强制待办成为可勾选的 checkListItem。 */
export function parseAiMarkdownToBlocks(markdown: string): BlockNoteContent {
  const normalized = normalizeAiMarkdown(markdown ?? "").trim();
  if (!normalized) return [];
  const fragment = importMarkdownFragment(normalized);
  const restored = restoreBlockPropsMarkers((fragment ?? []) as BlockNoteContent);
  const exploded = explodeAiGeneratedBlocks(restored);
  return exploded.length > 0 ? exploded : restored;
}

/**
 * 将 title + markdown 组合成合规的页面 BlockNoteContent
 * （首块恒为 H1 标题；markdown 先归一化，首行重复标题时跳过）。
 */
export function buildAiPageContent(title: string, markdown: string): JSONContent {
  const stripped = normalizeAiMarkdown(markdown)
    .replace(/^\s*#(?!#)[^\n]*\n?/, "")
    .trim();

  const bodyBlocks: BlockNoteContent = stripped
    ? parseAiMarkdownToBlocks(stripped)
    : [emptyBlock()];
  const safeBody = bodyBlocks.length > 0 ? bodyBlocks : [emptyBlock()];

  const content: BlockNoteContent = [titleHeadingBlock(title), ...safeBody];
  return normalizePageContent(content, { ensureFirstTitle: false }) as JSONContent;
}
