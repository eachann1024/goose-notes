import { useEffect, useMemo, useState } from "react";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import { useHistoryView } from "@/stores/useHistoryView";
import { usePages } from "@/stores/usePages";
import { resolveHistoryBackend } from "@/lib/history/backend";
import { filterAdjacentDuplicateHistoryEntries } from "@/lib/history/dedupe";
import { materializeVersion } from "@/lib/history/restore";
import type { HistoryIndex, HistoryIndexEntry } from "@/lib/history/types";
import {
  extractBlockNoteTitle,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import {
  type SelectedHistoryStatus,
  createSafeHistoryContent,
  formatGroupLabel,
} from "../historyViewPresentation";

export function useHistoryViewState() {
  const active = useHistoryView((s) => s.active);

  const selectedVersionId = useHistoryView((s) => s.selectedVersionId);

  const refreshTick = useHistoryView((s) => s.refreshTick);

  const exit = useHistoryView((s) => s.exit);

  const select = useHistoryView((s) => s.select);

  const bumpRefresh = useHistoryView((s) => s.bumpRefresh);

  const { getPage, updatePage } = usePages();

  const pageId = active;

  const page = pageId ? getPage(pageId) : undefined;

  const pageTitle = page ? extractBlockNoteTitle(page.content) || "无标题" : "";

  const [index, setIndex] = useState<HistoryIndex | null>(null);

  const [indexError, setIndexError] = useState<string | null>(null);

  const [selectedContent, setSelectedContent] =
    useState<BlockNoteContent | null>(null);

  const [selectedStatus, setSelectedStatus] =
    useState<SelectedHistoryStatus>("idle");

  const [isRestoring, setIsRestoring] = useState(false);

  const [pendingMilestoneVersionId, setPendingMilestoneVersionId] = useState<
    string | null
  >(null);

  // 加载版本索引
  useEffect(() => {
    if (!pageId) {
      setIndex(null);
      setIndexError(null);
      return;
    }
    let cancelled = false;
    setIndexError(null);
    const backend = resolveHistoryBackend(pageId);
    backend
      .loadIndex(pageId)
      .then(async (idx) => {
        const versions = await filterAdjacentDuplicateHistoryEntries(
          pageId,
          idx.versions,
          backend,
        );
        if (!cancelled) setIndex({ ...idx, versions });
      })
      .catch((error) => {
        if (!cancelled) {
          setIndex({ pageId, versions: [], lastVersionCharCount: 0 });
          setIndexError(describeDiskWriteError(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, refreshTick]);

  // 加载选中版本内容
  useEffect(() => {
    if (!pageId || !selectedVersionId) {
      setSelectedContent(null);
      setSelectedStatus("idle");
      return;
    }
    let cancelled = false;
    setSelectedContent(null);
    setSelectedStatus("loading");
    materializeVersion(pageId, selectedVersionId)
      .then((result) => {
        if (cancelled) return;
        if (!result || result.content == null) {
          setSelectedContent(null);
          setSelectedStatus("missing");
          return;
        }
        const safeContent = createSafeHistoryContent(result.content);
        if (!safeContent) {
          setSelectedContent(null);
          setSelectedStatus("error");
          return;
        }
        setSelectedContent(safeContent);
        setSelectedStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedContent(null);
          setSelectedStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, selectedVersionId]);

  useEffect(() => {
    if (!index || index.versions.length === 0) return;
    if (selectedVersionId) {
      if (index.versions.some((v) => v.versionId === selectedVersionId)) return;
    }
    const sorted = [...index.versions].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    select(sorted[0].versionId);
  }, [index, selectedVersionId, select]);

  useEffect(() => {
    if (pageId && !page) {
      exit();
    }
  }, [pageId, page, exit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [exit]);

  const groups = useMemo(() => {
    if (!index || index.versions.length === 0) return [];
    const sorted = [...index.versions].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const now = Date.now();
    const result: { label: string; items: HistoryIndexEntry[] }[] = [];
    let currentLabel = "";
    for (const v of sorted) {
      const label = formatGroupLabel(v.createdAt, now);
      if (label !== currentLabel) {
        result.push({ label, items: [] });
        currentLabel = label;
      }
      result[result.length - 1].items.push(v);
    }
    return result;
  }, [index]);

  const selectedEntry = useMemo(
    () =>
      index?.versions.find((v) => v.versionId === selectedVersionId) ?? null,
    [index, selectedVersionId],
  );
  return {
    active,
    selectedVersionId,
    refreshTick,
    exit,
    select,
    bumpRefresh,
    getPage,
    updatePage,
    pageId,
    page,
    pageTitle,
    index,
    setIndex,
    indexError,
    setIndexError,
    selectedContent,
    setSelectedContent,
    selectedStatus,
    setSelectedStatus,
    isRestoring,
    setIsRestoring,
    pendingMilestoneVersionId,
    setPendingMilestoneVersionId,
    groups,
    selectedEntry,
  };
}
