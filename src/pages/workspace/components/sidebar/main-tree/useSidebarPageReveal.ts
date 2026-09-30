import { useEffect, useRef, type RefObject } from "react";
import type { Page } from "@/types";

type RevealPage = Pick<Page, "id" | "workspaceId" | "parentId" | "trashedAt" | "localUnsaved">;

interface SidebarPageRevealOptions {
  activeNotebookId: string | null;
  highlightedPageId: string | null;
  expandPageId: string | null;
  pages: Record<string, RevealPage>;
  expandedIds: string[];
  treeReady: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  setExpanded: (notebookId: string, ids: string[]) => void;
  consumeRequest: (pageId: string) => void;
}

/** Reveal is a pending navigation, not tree focus. Only a rendered, visible row completes it. */
export function useSidebarPageReveal({
  activeNotebookId,
  highlightedPageId,
  expandPageId,
  pages,
  expandedIds,
  treeReady,
  scrollContainerRef,
  setExpanded,
  consumeRequest,
}: SidebarPageRevealOptions) {
  const observed = useRef<{
    notebookId: string | null;
    highlightedId: string | null;
    requestedId: string | null;
  } | null>(null);
  const pending = useRef<{ pageId: string; explicit: boolean } | null>(null);

  useEffect(() => {
    const previous = observed.current;
    const pageChanged = !previous || previous.highlightedId !== highlightedPageId;
    const notebookChanged = !previous || previous.notebookId !== activeNotebookId;
    const requestChanged = !previous || previous.requestedId !== expandPageId;
    observed.current = {
      notebookId: activeNotebookId,
      highlightedId: highlightedPageId,
      requestedId: expandPageId,
    };

    if (requestChanged && expandPageId) {
      pending.current = { pageId: expandPageId, explicit: true };
    } else if (pageChanged || notebookChanged) {
      // A notebook can switch before its page is hydrated. Keep an explicit request
      // across that intermediate render, but a newer displayed page supersedes it.
      if ((pageChanged && highlightedPageId) || !pending.current?.explicit) {
        pending.current = highlightedPageId
          ? { pageId: highlightedPageId, explicit: false }
          : null;
      }
    }

    const intent = pending.current;
    if (!intent || !activeNotebookId || !treeReady) return;
    const page = pages[intent.pageId];
    if (!page || page.workspaceId !== activeNotebookId || page.trashedAt || page.localUnsaved) return;

    const ancestors: string[] = [];
    const seen = new Set([page.id]);
    let parentId = page.parentId;
    while (parentId) {
      const parent = pages[parentId];
      // Incomplete hydration must not count as a successful reveal.
      if (!parent || parent.workspaceId !== activeNotebookId || parent.trashedAt || parent.localUnsaved || seen.has(parentId)) return;
      seen.add(parentId);
      ancestors.push(parentId);
      parentId = parent.parentId;
    }
    const missing = ancestors.filter((id) => !expandedIds.includes(id));
    if (missing.length) {
      setExpanded(activeNotebookId, [...expandedIds, ...missing]);
      return; // The next committed render still owns the uncompleted intent.
    }

    const container = scrollContainerRef.current;
    if (!container) return;
    let cancelled = false;
    let frame: number | null = null;
    const stop = () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      resize?.disconnect();
    };
    const reveal = () => {
      frame = null;
      if (cancelled) return;
      const row = Array.from(container.querySelectorAll<HTMLElement>("[data-rct-item-id]"))
        .find((element) => element.getAttribute("data-rct-item-id") === intent.pageId);
      if (!row) return;
      const bounds = container.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      if (!container.clientHeight || !rect.height) return;
      const top = bounds.top + container.clientTop;
      const bottom = top + container.clientHeight;
      // Do not use focusItem/scrollIntoView: both can affect focus or outer scrollers.
      const delta = rect.top < top || rect.height > container.clientHeight
        ? rect.top - top
        : rect.bottom > bottom ? rect.bottom - bottom : 0;
      if (delta) container.scrollTop += delta;
      pending.current = null;
      stop();
      // Also retire an older explicit request superseded by this displayed page.
      if (expandPageId) consumeRequest(expandPageId);
    };
    const schedule = () => {
      if (!cancelled && frame === null) frame = window.requestAnimationFrame(reveal);
    };
    // RCT may commit its rows after the ancestor expansion. Observe rather than
    // polling; cancellation never consumes the intent or marks it completed.
    const mutations = new MutationObserver(schedule);
    mutations.observe(container, { childList: true, subtree: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(container);
    schedule();
    return stop;
  }, [activeNotebookId, highlightedPageId, expandPageId, pages, expandedIds, treeReady, scrollContainerRef, setExpanded, consumeRequest]);
}
