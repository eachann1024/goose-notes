import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { wikiKeysForLocalPath, wikiPathKey } from "@/lib/wikiLink";

export type PageMentionNavigationResult =
  | { ok: false; reason: "missing" | "trashed" | "empty" }
  | {
      ok: true;
      page: Page;
      switchNotebook: boolean;
    };

function isJumpablePage(page: Page | undefined): page is Page {
  return page !== undefined && !page.trashedAt && !page.isFolder;
}

function pageWikiKeys(page: Page): string[] {
  const keys = [wikiPathKey(getPageTitle(page))];
  if (page.localFilePath) {
    keys.push(...wikiKeysForLocalPath(page.localFilePath));
  }
  return keys;
}

function shorterPath(a: Page, b: Page): number {
  const aPath = a.localFilePath?.length ?? Number.MAX_SAFE_INTEGER;
  const bPath = b.localFilePath?.length ?? Number.MAX_SAFE_INTEGER;
  if (aPath !== bPath) return aPath - bPath;
  return a.id.localeCompare(b.id);
}

export function resolveWikiLinkTarget(
  target: string | undefined | null,
  pages: Record<string, Page>,
  activeNotebookId: string | null,
): Page | null {
  const key = wikiPathKey(typeof target === "string" ? target : "");
  if (!key) return null;

  const matches = Object.values(pages).filter((page) => {
    if (!isJumpablePage(page)) return false;
    return pageWikiKeys(page).includes(key);
  });
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0] ?? null;

  const inActive = activeNotebookId
    ? matches.filter((page) => page.workspaceId === activeNotebookId)
    : [];
  const pool = inActive.length > 0 ? inActive : matches;
  pool.sort(shorterPath);
  return pool[0] ?? null;
}

export function resolvePageMentionNavigation(
  pageId: string | undefined | null,
  pages: Record<string, Page>,
  activeNotebookId: string | null,
  wikiTarget?: string | null,
): PageMentionNavigationResult {
  const id = typeof pageId === "string" ? pageId.trim() : "";
  if (id) {
    const page = pages[id];
    if (page?.trashedAt) return { ok: false, reason: "trashed" };
    if (isJumpablePage(page)) {
      return {
        ok: true,
        page,
        switchNotebook:
          Boolean(page.workspaceId) && page.workspaceId !== activeNotebookId,
      };
    }
  }

  const wikiPage = resolveWikiLinkTarget(wikiTarget, pages, activeNotebookId);
  if (wikiPage) {
    return {
      ok: true,
      page: wikiPage,
      switchNotebook:
        Boolean(wikiPage.workspaceId) &&
        wikiPage.workspaceId !== activeNotebookId,
    };
  }

  if (!id && !wikiPathKey(wikiTarget ?? "")) return { ok: false, reason: "empty" };
  return { ok: false, reason: "missing" };
}
