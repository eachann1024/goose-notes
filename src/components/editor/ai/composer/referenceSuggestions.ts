import type { Page } from "@/types";
import type { Notebook } from "@/stores/useNotebooks";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { isPinyinQuery, pinyinMatchIndices } from "@/lib/pinyin-search";
import type { AiReferenceSuggestionItem } from "./referenceTypes";
import {
  buildAiFileReferenceAttrs,
  getNotebookSnapshot,
  getLocationSnapshot,
} from "./referenceMetadata";

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

/**
 * 建议列表副标题：本地文件只展示相对路径（如 Dev/New Project/Codex.md），
 * 避免「本地文件 · 0Markdown · …」重复上级信息；跨笔记本时才补笔记本名。
 */
function buildDescription(
  page: Page,
  notebooks: Record<string, Notebook>,
  activeNotebookId: string | null,
) {
  const wsId = page.workspaceId ?? (page as { notebookId?: string }).notebookId;
  const notebook = getNotebookSnapshot(wsId, notebooks);
  const notebookName = notebook?.name ?? "未知笔记本";
  const isActiveNotebook =
    activeNotebookId != null && wsId === activeNotebookId;

  if (page.isFolder || page.localFilePath) {
    const location = getLocationSnapshot(page, notebooks);
    if (isActiveNotebook) return location;
    return `${notebookName} · ${location}`;
  }

  return isActiveNotebook ? "应用页面" : `应用页面 · ${notebookName}`;
}

function pageFilenameStem(page: Page): string {
  if (!page.localFilePath) return getPageTitle(page);
  const name = page.localFilePath.split(/[\\/]/).pop() || "";
  return name.replace(/\.(md|markdown)$/i, "").trim() || getPageTitle(page);
}

function splitSearchTokens(value: string): string[] {
  return value.split(/[\s/_.:-]+/).filter(Boolean);
}

/**
 * 只搜标题、文件名、相对路径，不搜笔记正文。
 * 分数越小越靠前：精确标题 > 前缀 > 分段 > 子串 > 路径 > 拼音。
 */
function scoreFieldMatch(
  field: string,
  query: string,
  base: number,
): number | null {
  if (!field) return null;
  if (field === query) return base;
  if (field.startsWith(query)) return base + 10;
  if (splitSearchTokens(field).includes(query)) return base + 20;
  if (field.includes(query)) return base + 30;
  return null;
}

function scoreAiReferenceQuery(
  page: Page,
  notebooks: Record<string, Notebook>,
  normalizedQuery: string,
  rawQuery: string,
): number | null {
  if (!normalizedQuery) return 0;

  const title = normalizeSearchValue(getPageTitle(page));
  const filename = normalizeSearchValue(pageFilenameStem(page));
  const location = normalizeSearchValue(
    getLocationSnapshot(page, notebooks).replace(/\.(md|markdown)$/i, ""),
  );

  let best = Number.POSITIVE_INFINITY;
  const consider = (score: number | null) => {
    if (score != null && score < best) best = score;
  };

  consider(scoreFieldMatch(title, normalizedQuery, 0));
  consider(scoreFieldMatch(filename, normalizedQuery, 1));

  if (
    page.localFilePath &&
    location &&
    location !== title &&
    location !== filename
  ) {
    const segments = location.split("/").filter(Boolean);
    if (segments.some((part) => part === normalizedQuery)) consider(40);
    else if (segments.some((part) => part.startsWith(normalizedQuery))) {
      consider(45);
    } else if (location.includes(normalizedQuery)) consider(50);
  }

  if (
    best === Number.POSITIVE_INFINITY &&
    isPinyinQuery(rawQuery.trim()) &&
    pinyinMatchIndices(getPageTitle(page), rawQuery.trim()) !== null
  ) {
    consider(60);
  }

  return best === Number.POSITIVE_INFINITY ? null : best;
}

function matchesAiReferenceQuery(
  page: Page,
  notebooks: Record<string, Notebook>,
  normalizedQuery: string,
  rawQuery: string,
) {
  return (
    scoreAiReferenceQuery(page, notebooks, normalizedQuery, rawQuery) != null
  );
}

function compareSuggestionItems(
  a: Page,
  b: Page,
  activeNotebookId: string | null,
  notebooks: Record<string, Notebook>,
  queryScore?: (page: Page) => number,
) {
  if (queryScore) {
    const scoreDelta = queryScore(a) - queryScore(b);
    if (scoreDelta !== 0) return scoreDelta;
    const titleLenDelta = getPageTitle(a).length - getPageTitle(b).length;
    if (titleLenDelta !== 0) return titleLenDelta;
  }

  const aWsId = a.workspaceId ?? (a as { notebookId?: string }).notebookId;
  const bWsId = b.workspaceId ?? (b as { notebookId?: string }).notebookId;
  const aIsActiveNotebook = aWsId === activeNotebookId;
  const bIsActiveNotebook = bWsId === activeNotebookId;
  if (aIsActiveNotebook !== bIsActiveNotebook) {
    return aIsActiveNotebook ? -1 : 1;
  }

  const aNotebook = getNotebookSnapshot(aWsId, notebooks);
  const bNotebook = getNotebookSnapshot(bWsId, notebooks);
  const notebookCompare = (aNotebook?.name ?? "").localeCompare(
    bNotebook?.name ?? "",
    "zh-CN",
    { numeric: true },
  );
  if (notebookCompare !== 0) return notebookCompare;

  const titleCompare = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
    numeric: true,
  });
  if (titleCompare !== 0) return titleCompare;

  return a.id.localeCompare(b.id);
}

export function getAiReferenceSuggestionItems(
  query: string,
  pages: Record<string, Page>,
  notebooks: Record<string, Notebook>,
  activeNotebookId: string | null,
  options?: {
    includeFolders?: boolean;
    notebookId?: string | null;
    priorityPageId?: string | null;
  },
) {
  const normalizedQuery = normalizeSearchValue(query);

  return Object.values(pages)
    .filter((page) => !page.trashedAt)
    .filter((page) => {
      if (!options?.notebookId) return true;
      const wsId =
        page.workspaceId ?? (page as { notebookId?: string }).notebookId;
      return wsId === options.notebookId;
    })
    .filter((page) => options?.includeFolders || !page.isFolder)
    .filter((page) =>
      matchesAiReferenceQuery(page, notebooks, normalizedQuery, query),
    )
    .sort((a, b) => {
      if (!normalizedQuery && options?.priorityPageId) {
        if (a.id === options.priorityPageId) return -1;
        if (b.id === options.priorityPageId) return 1;
      }
      return compareSuggestionItems(
        a,
        b,
        activeNotebookId,
        notebooks,
        normalizedQuery
          ? (page) =>
              scoreAiReferenceQuery(page, notebooks, normalizedQuery, query) ??
              Number.POSITIVE_INFINITY
          : undefined,
      );
    })
    .slice(0, 30)
    .map((page) => {
      const attrs = buildAiFileReferenceAttrs(page, notebooks);
      return {
        ...attrs,
        title: attrs.titleSnapshot,
        description: buildDescription(page, notebooks, activeNotebookId),
        isFolder: page.isFolder,
      } satisfies AiReferenceSuggestionItem;
    });
}
