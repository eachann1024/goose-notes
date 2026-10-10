import type { JSONContent } from "@/types";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";
import { importMarkdownFragment } from "@/lib/export/markdown/parse";
import { restoreBlockPropsMarkers } from "@/lib/export/markdown/blockPropsMarker";
import { explodeAiGeneratedBlocks } from "@/lib/ai-write/explodeAiGeneratedBlocks";
import { inheritPresentationFromSource } from "../inheritPresentation";

export function getTopLevelBlocks(content: JSONContent): any[] {
  if (Array.isArray(content)) return content as any[];
  if (content && typeof content === "object") {
    const nested = (content as { content?: unknown }).content;
    if (Array.isArray(nested)) return nested as any[];
  }
  return [];
}

export function cloneBlocks(blocks: any[]): any[] {
  if (typeof structuredClone === "function") return structuredClone(blocks);
  return JSON.parse(JSON.stringify(blocks)) as any[];
}

function stripBlockIds(blocks: any[]): any[] {
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const { id: _omit, ...rest } = block as Record<string, unknown>;
    return rest;
  });
}

/** 块级 markdown 指纹（与序列化一致，不含不可见 marker 特殊处理） */
function blockMarkdownFingerprint(block: any): string {
  return jsonContentToMarkdown([block] as any);
}

/**
 * 按 markdown 指纹做 LCS 对齐：匹配对保留 original 块对象，
 * 未匹配的 candidate 区间保留 candidate 块。
 * 公共前缀/后缀是 LCS 的退化情形。
 */
export function alignBlocksByMarkdownFingerprint(
  original: any[],
  candidate: any[],
): { merged: any[]; preservedCount: number; replacedCount: number } {
  const n = original.length;
  const m = candidate.length;
  if (m === 0) {
    return { merged: [], preservedCount: 0, replacedCount: 0 };
  }
  if (n === 0) {
    return {
      merged: candidate.slice(),
      preservedCount: 0,
      replacedCount: m,
    };
  }

  const a = original.map(blockMarkdownFingerprint);
  const b = candidate.map(blockMarkdownFingerprint);

  // dp[i][j] = LCS 长度（a[0..i), b[0..j)）
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // 回溯匹配对（0-based 下标），按 candidate 顺序
  const matches: Array<{ oi: number; ci: number }> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      matches.push({ oi: i - 1, ci: j - 1 });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  matches.reverse();

  const merged: any[] = [];
  let prevOi = -1;
  let prevCi = -1;
  for (const match of matches) {
    const origGap = original.slice(prevOi + 1, match.oi);
    const candGap = candidate.slice(prevCi + 1, match.ci);
    merged.push(...inheritPresentationFromSource(origGap, candGap));
    // 保留原块对象（id / props / nesting）
    merged.push(original[match.oi]);
    prevOi = match.oi;
    prevCi = match.ci;
  }
  merged.push(
    ...inheritPresentationFromSource(
      original.slice(prevOi + 1),
      candidate.slice(prevCi + 1),
    ),
  );

  const preservedCount = matches.length;
  return {
    merged,
    preservedCount,
    replacedCount: m - preservedCount,
  };
}

export function parseFragment(markdown: string): any[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  const fragment = importMarkdownFragment(trimmed);
  if (!fragment || !Array.isArray(fragment) || fragment.length === 0) {
    return [];
  }
  // 顺序：import → 恢复 props 标记 → 去掉 id（避免与原页冲突）→ 拆行成独立块
  const restored = restoreBlockPropsMarkers(fragment as any);
  return stripBlockIds(explodeAiGeneratedBlocks(restored as any[]) as any[]);
}

/**
 * normalizePageContent / normalizeBlock 会丢掉 id。
 * 按块 markdown 指纹 LCS 对齐，把原块 id 写回未改动块。
 */
export function reattachPreservedBlockIds(
  source: any[],
  normalized: any[],
): any[] {
  if (!Array.isArray(normalized) || normalized.length === 0) return normalized;
  const n = source.length;
  const m = normalized.length;
  if (n === 0) return normalized;

  const a = source.map(blockMarkdownFingerprint);
  const b = normalized.map(blockMarkdownFingerprint);

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const matches: Array<{ oi: number; ci: number }> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      matches.push({ oi: i - 1, ci: j - 1 });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  const out = normalized.map((b) =>
    b && typeof b === "object" ? { ...b } : b,
  );
  for (const match of matches) {
    const srcId = source[match.oi]?.id;
    if (srcId != null && out[match.ci] && out[match.ci].id == null) {
      out[match.ci] = { ...out[match.ci], id: srcId };
    }
  }
  return out;
}
