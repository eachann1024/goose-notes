import type { JSONContent } from "@/types";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";
import { inheritPresentationFromSource } from "../inheritPresentation";
import { normalizePageContent } from "@/components/editor/utils/blocknote-content";
import {
  getTopLevelBlocks,
  cloneBlocks,
  parseFragment,
  reattachPreservedBlockIds,
  alignBlocksByMarkdownFingerprint,
} from "./surgicalBlocks";
import {
  buildSegments,
  joinSegments,
  findAllOccurrences,
  findWhitespaceFlexible,
  mapCharRangeToBlocks,
  locateInRegion,
} from "./surgicalMatching";
export { alignBlocksByMarkdownFingerprint } from "./surgicalBlocks";

export interface SurgicalSearchReplaceSuccess {
  ok: true;
  content: JSONContent;
  replacedCount: number;
  /** 被替换的顶层块数量（替换前累计） */
  touchedBlockCount: number;
}

export interface SurgicalSearchReplaceFailure {
  ok: false;
  error: string;
  currentMarkdownPreview?: string;
}

export type SurgicalSearchReplaceResult =
  | SurgicalSearchReplaceSuccess
  | SurgicalSearchReplaceFailure;

export interface FullEditMergeResult {
  content: JSONContent;
  preservedBlockCount: number;
  replacedBlockCount: number;
}

function applyOneMatch(
  blocks: any[],
  find: string,
  newString: string,
  matchStart: number,
  matchLength: number,
): { touched: number } | null {
  const segments = buildSegments(blocks);
  const range = mapCharRangeToBlocks(
    segments,
    matchStart,
    matchStart + matchLength,
  );
  if (!range) return null;

  const { startBlock, endBlock } = range;
  const regionBlocks = blocks.slice(startBlock, endBlock + 1);
  const regionMd = jsonContentToMarkdown(regionBlocks as any);
  if (!regionMd) return null;

  const located = locateInRegion(regionMd, find);
  if (!located) return null;

  const nextRegionMd =
    regionMd.slice(0, located.localStart) +
    newString +
    regionMd.slice(located.localStart + located.localLen);

  const replacement = inheritPresentationFromSource(
    regionBlocks,
    parseFragment(nextRegionMd),
  );
  const beforeCount = endBlock - startBlock + 1;
  blocks.splice(startBlock, beforeCount, ...replacement);
  return { touched: beforeCount };
}

/**
 * 在页面内容上应用 search/replace，仅重解析被命中的块范围。
 */
export function applySearchReplacePreservingBlocks(
  content: JSONContent,
  oldString: string,
  newString: string,
  options?: { replaceAll?: boolean },
): SurgicalSearchReplaceResult {
  const find = oldString;
  if (!find) {
    return { ok: false, error: "search_replace 的 oldString 不能为空" };
  }

  const blocks = cloneBlocks(getTopLevelBlocks(content));
  if (blocks.length === 0) {
    return { ok: false, error: "页面为空，无法局部替换" };
  }

  const replaceAll = options?.replaceAll === true;
  let replacedCount = 0;
  let touchedBlockCount = 0;

  const previewOf = (md: string) =>
    md.length > 400 ? `${md.slice(0, 400)}…` : md;

  // 多轮：每轮基于当前 blocks 重建 markdown，从后往前应用本轮全部匹配，避免下标错乱。
  let guard = 0;
  while (guard < 64) {
    guard += 1;
    const segments = buildSegments(blocks);
    const fullMd = joinSegments(segments);

    const exactPositions = findAllOccurrences(fullMd, find);
    let matches: Array<{ start: number; length: number }>;
    if (exactPositions.length > 0) {
      matches = exactPositions.map((start) => ({
        start,
        length: find.length,
      }));
    } else {
      const flex = findWhitespaceFlexible(fullMd, find);
      if (!flex) {
        if (replacedCount === 0) {
          return {
            ok: false,
            error:
              "未在页面中找到 oldString 的精确匹配。请先 readPage，复制原文片段作为 oldString。",
            currentMarkdownPreview: previewOf(fullMd),
          };
        }
        break;
      }
      matches = [{ start: flex.index, length: flex.matchedLength }];
    }

    if (!replaceAll) {
      matches = [matches[0]!];
    }

    // 从后往前，同一全文布局下下标稳定
    matches.sort((a, b) => b.start - a.start);
    let appliedThisRound = 0;
    for (const match of matches) {
      // 注意：同轮多次 splice 后，后续 match 的 char 下标仍对「本轮开始」有效，
      // 但 blocks 已变。因此同轮只安全处理「从后往前」且每次重新 buildSegments 会漂移。
      // 正确做法：同轮只 apply 一处（最后一处），然后 while 重建。
      const result = applyOneMatch(
        blocks,
        find,
        newString,
        match.start,
        match.length,
      );
      if (!result) continue;
      replacedCount += 1;
      touchedBlockCount += result.touched;
      appliedThisRound += 1;
      // 每成功一处就重建全文，防止同轮多处错位
      break;
    }

    if (appliedThisRound === 0) {
      if (replacedCount === 0) {
        return {
          ok: false,
          error:
            "未能将 oldString 映射到可替换的块范围。请缩小片段或重新 readPage 后重试。",
          currentMarkdownPreview: previewOf(fullMd),
        };
      }
      break;
    }

    if (!replaceAll) break;
  }

  if (replacedCount === 0) {
    const fullMd = joinSegments(buildSegments(blocks));
    return {
      ok: false,
      error:
        "未能将 oldString 映射到可替换的块范围。请缩小片段或重新 readPage 后重试。",
      currentMarkdownPreview: previewOf(fullMd),
    };
  }

  const normalized = normalizePageContent(blocks as any, {
    ensureFirstTitle: false,
  }) as any[];
  const nextContent = reattachPreservedBlockIds(
    blocks,
    getTopLevelBlocks(normalized),
  ) as JSONContent;

  return {
    ok: true,
    content: nextContent,
    replacedCount,
    touchedBlockCount,
  };
}

/**
 * 全量 edit 兜底：按块 markdown 指纹 LCS 对齐，保留未改动原块（id/props/nesting），
 * 仅对未匹配区间使用重解析结果。前缀/后缀对齐是 LCS 退化情形。
 */
export function mergeFullEditPreservingUnchangedBlocks(
  originalContent: JSONContent,
  newMarkdown: string,
  options?: { ensureFirstTitle?: boolean },
): FullEditMergeResult {
  const before = getTopLevelBlocks(originalContent);
  const parsed = parseFragment(newMarkdown);
  const ensureFirstTitle = options?.ensureFirstTitle !== false;

  if (before.length === 0 || parsed.length === 0) {
    const content = normalizePageContent(
      parsed.length ? (parsed as any) : (before as any),
      { ensureFirstTitle },
    ) as JSONContent;
    return {
      content,
      preservedBlockCount: 0,
      replacedBlockCount: getTopLevelBlocks(content).length,
    };
  }

  const { merged, preservedCount, replacedCount } =
    alignBlocksByMarkdownFingerprint(before, parsed);

  const normalized = normalizePageContent(merged as any, {
    ensureFirstTitle,
  }) as any[];
  const content = reattachPreservedBlockIds(
    merged,
    getTopLevelBlocks(normalized),
  ) as JSONContent;

  return {
    content,
    preservedBlockCount: preservedCount,
    replacedBlockCount: replacedCount,
  };
}
