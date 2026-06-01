import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { countWords } from "@/components/editor/utils/content-text-extractor";
import { historyRepository } from "./repository";
import type {
  HistoryIndexEntry,
  HistoryTrigger,
  HistoryVersion,
} from "./types";

/** 单页面历史版本硬上限。超过时淘汰最旧的非里程碑。 */
const MAX_VERSIONS_PER_PAGE = 50;

function genVersionId(now: number): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function estimateSize(content: BlockNoteContent): number {
  try {
    return JSON.stringify(content).length;
  } catch {
    return 0;
  }
}

export interface RecordSnapshotParams {
  pageId: string;
  workspaceId: string;
  content: BlockNoteContent;
  trigger: HistoryTrigger;
  isMilestone?: boolean;
  label?: string;
}

/**
 * 落一个完整快照版本。返回新创建的索引条目；若与最新版本无差异且非手动，则返回 null 跳过。
 */
export function recordHistorySnapshot(
  params: RecordSnapshotParams,
): HistoryIndexEntry | null {
  const { pageId, workspaceId, content, trigger, isMilestone, label } = params;

  const index = historyRepository.loadIndex(pageId);
  const now = Date.now();
  const charCount = countWords(content);
  const charDelta = charCount - index.lastVersionCharCount;

  if (
    trigger === "idle" &&
    charDelta === 0 &&
    !isMilestone &&
    index.versions.length > 0
  ) {
    return null;
  }

  const versionId = genVersionId(now);
  const size = estimateSize(content);

  const version: HistoryVersion = {
    versionId,
    pageId,
    workspaceId,
    createdAt: now,
    trigger,
    isMilestone: !!isMilestone,
    label,
    charCount,
    charDelta,
    size,
    content,
  };

  historyRepository.saveVersion(version);

  const entry: HistoryIndexEntry = {
    versionId,
    createdAt: now,
    trigger,
    isMilestone: !!isMilestone,
    label,
    charCount,
    charDelta,
    size,
  };

  let nextVersions = [...index.versions, entry];

  if (nextVersions.length > MAX_VERSIONS_PER_PAGE) {
    while (nextVersions.length > MAX_VERSIONS_PER_PAGE) {
      const evictIdx = nextVersions.findIndex((v) => !v.isMilestone);
      if (evictIdx === -1) break;
      const evicted = nextVersions[evictIdx];
      historyRepository.removeVersion(pageId, evicted.versionId);
      nextVersions = nextVersions.filter((_, i) => i !== evictIdx);
    }
  }

  historyRepository.saveIndex({
    pageId,
    versions: nextVersions,
    lastVersionCharCount: charCount,
  });

  return entry;
}

function patchEntry(
  pageId: string,
  versionId: string,
  patch: Partial<HistoryIndexEntry>,
): void {
  const index = historyRepository.loadIndex(pageId);
  const nextVersions = index.versions.map((v) =>
    v.versionId === versionId ? { ...v, ...patch } : v,
  );
  historyRepository.saveIndex({ ...index, versions: nextVersions });

  const version = historyRepository.loadVersion(pageId, versionId);
  if (version) {
    historyRepository.saveVersion({ ...version, ...patch });
  }
}

export function markMilestone(
  pageId: string,
  versionId: string,
  label?: string,
): void {
  patchEntry(pageId, versionId, {
    isMilestone: true,
    ...(label !== undefined ? { label } : {}),
  });
}

export function unmarkMilestone(pageId: string, versionId: string): void {
  patchEntry(pageId, versionId, { isMilestone: false });
}

export function renameVersion(
  pageId: string,
  versionId: string,
  label: string,
): void {
  patchEntry(pageId, versionId, { label });
}

export function deleteVersion(pageId: string, versionId: string): void {
  const index = historyRepository.loadIndex(pageId);
  const nextVersions = index.versions.filter((v) => v.versionId !== versionId);
  historyRepository.removeVersion(pageId, versionId);
  historyRepository.saveIndex({ ...index, versions: nextVersions });
}
