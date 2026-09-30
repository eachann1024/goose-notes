import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { countWords } from "@/components/editor/utils/content-text-extractor";
import { resolveHistoryBackend, type HistoryBackend } from "./backend";
import { getHistoryVisibleSignature } from "./contentSignature";
import { selectEvictedVersionIds } from "./retention";
import { usePages } from "@/stores/usePages";
import type {
  HistoryIndexEntry,
  HistoryTrigger,
  HistoryVersion,
} from "./types";

/** 自动历史之间至少相隔 5 分钟；期间编辑由记录器合并为最新 pending。 */
export const AUTOMATIC_SNAPSHOT_MIN_INTERVAL_MS = 5 * 60_000;

const indexWriteChains = new Map<string, Promise<unknown>>();

function withIndexLock<T>(pageId: string, fn: () => Promise<T>): Promise<T> {
  const prev = indexWriteChains.get(pageId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  indexWriteChains.set(pageId, next);
  next.finally(() => {
    if (indexWriteChains.get(pageId) === next) indexWriteChains.delete(pageId);
  });
  return next;
}

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

async function isSameAsLatestVersion(
  pageId: string,
  index: { versions: Array<{ versionId: string }> },
  content: BlockNoteContent,
  localFrontmatter: string | undefined,
  backend: HistoryBackend,
): Promise<boolean> {
  const latestEntry = index.versions[index.versions.length - 1];
  if (!latestEntry) return false;
  const latest = await backend.loadVersion(pageId, latestEntry.versionId);
  if (!latest) return false;
  return (
    getHistoryVisibleSignature(latest.content, latest.localFrontmatter) ===
    getHistoryVisibleSignature(content, localFrontmatter)
  );
}

export interface RecordSnapshotParams {
  pageId: string;
  workspaceId: string;
  content: BlockNoteContent;
  trigger: HistoryTrigger;
  isMilestone?: boolean;
  label?: string;
}

export type RecordHistorySnapshotResult =
  | { status: "created"; entry: HistoryIndexEntry }
  | { status: "updated"; entry: HistoryIndexEntry }
  | { status: "duplicate" }
  | { status: "rate-limited"; retryAt: number };

/**
 * 落一个完整快照版本。重复或被自动限频时返回 null；同内容里程碑会升级最新条目。
 */
export async function recordHistorySnapshot(
  params: RecordSnapshotParams,
): Promise<HistoryIndexEntry | null> {
  const result = await recordHistorySnapshotDetailed(params);
  return result.status === "created" || result.status === "updated"
    ? result.entry
    : null;
}

export async function recordHistorySnapshotDetailed(
  params: RecordSnapshotParams,
): Promise<RecordHistorySnapshotResult> {
  return withIndexLock(params.pageId, () =>
    recordHistorySnapshotUnlocked(params),
  );
}

async function recordHistorySnapshotUnlocked(
  params: RecordSnapshotParams,
): Promise<RecordHistorySnapshotResult> {
  const { pageId, workspaceId, content, trigger, isMilestone, label } = params;

  const backend = resolveHistoryBackend(pageId);
  const index = await backend.loadIndex(pageId);
  const now = Date.now();
  const charCount = countWords(content);
  const charDelta = charCount - index.lastVersionCharCount;
  const latestEntry = index.versions[index.versions.length - 1];
  const page = usePages.getState().pages[pageId];
  const localFrontmatter = page?.localFrontmatter;

  if (
    await isSameAsLatestVersion(
      pageId,
      index,
      content,
      localFrontmatter,
      backend,
    )
  ) {
    if (
      latestEntry &&
      (isMilestone || label !== undefined) &&
      (!latestEntry.isMilestone ||
        (label !== undefined && label !== latestEntry.label))
    ) {
      await patchEntryUnlocked(pageId, latestEntry.versionId, {
        ...(isMilestone ? { isMilestone: true } : {}),
        ...(label !== undefined ? { label } : {}),
      });
      return {
        status: "updated",
        entry: {
          ...latestEntry,
          ...(isMilestone ? { isMilestone: true } : {}),
          ...(label !== undefined ? { label } : {}),
        },
      };
    }
    return { status: "duplicate" };
  }

  if (
    trigger === "idle" &&
    latestEntry &&
    now - latestEntry.createdAt < AUTOMATIC_SNAPSHOT_MIN_INTERVAL_MS
  ) {
    return {
      status: "rate-limited",
      retryAt: latestEntry.createdAt + AUTOMATIC_SNAPSHOT_MIN_INTERVAL_MS,
    };
  }

  const versionId = genVersionId(now);
  const size = estimateSize(content);

  // 本地文件夹页面额外保存 frontmatter
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
    ...(localFrontmatter !== undefined ? { localFrontmatter } : {}),
  };

  await backend.saveVersion(version);

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
  const evictedVersionIds = selectEvictedVersionIds(nextVersions);
  if (evictedVersionIds.length > 0) {
    const evictedSet = new Set(evictedVersionIds);
    for (const versionId of evictedVersionIds) {
      await backend.removeVersion(pageId, versionId);
    }
    nextVersions = nextVersions.filter((v) => !evictedSet.has(v.versionId));
  }

  await backend.saveIndex({
    pageId,
    versions: nextVersions,
    lastVersionCharCount: charCount,
  });

  return { status: "created", entry };
}

async function patchEntry(
  pageId: string,
  versionId: string,
  patch: Partial<HistoryIndexEntry>,
): Promise<void> {
  await withIndexLock(pageId, () =>
    patchEntryUnlocked(pageId, versionId, patch),
  );
}

async function patchEntryUnlocked(
  pageId: string,
  versionId: string,
  patch: Partial<HistoryIndexEntry>,
): Promise<void> {
  const backend = resolveHistoryBackend(pageId);
  const index = await backend.loadIndex(pageId);
  const nextVersions = index.versions.map((v) =>
    v.versionId === versionId ? { ...v, ...patch } : v,
  );
  await backend.saveIndex({ ...index, versions: nextVersions });

  const version = await backend.loadVersion(pageId, versionId);
  if (version) {
    await backend.saveVersion({ ...version, ...patch });
  }
}

export async function markMilestone(
  pageId: string,
  versionId: string,
  label?: string,
): Promise<void> {
  await patchEntry(pageId, versionId, {
    isMilestone: true,
    ...(label !== undefined ? { label } : {}),
  });
}

export async function unmarkMilestone(
  pageId: string,
  versionId: string,
): Promise<void> {
  await patchEntry(pageId, versionId, { isMilestone: false });
}

export async function renameVersion(
  pageId: string,
  versionId: string,
  label: string,
): Promise<void> {
  await patchEntry(pageId, versionId, { label });
}

export async function deleteVersion(
  pageId: string,
  versionId: string,
): Promise<void> {
  await withIndexLock(pageId, async () => {
    const backend = resolveHistoryBackend(pageId);
    const index = await backend.loadIndex(pageId);
    const target = index.versions.find((v) => v.versionId === versionId);
    if (!target || target.isMilestone) return;
    const nextVersions = index.versions.filter(
      (v) => v.versionId !== versionId,
    );
    await backend.removeVersion(pageId, versionId);
    await backend.saveIndex({ ...index, versions: nextVersions });
  });
}
