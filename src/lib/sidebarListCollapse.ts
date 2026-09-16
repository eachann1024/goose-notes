import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";

/** 侧栏页面树 / 收藏树：点过这里之后 Esc 收起全部展开项。 */
export const SIDEBAR_PAGE_LIST_SELECTOR = [
  ".rct-main-tree",
  "[data-sidebar-page-list]",
  ".sidebar-tree-row",
  ".sidebar-favorites-label",
].join(", ");

const SIDEBAR_LIST_EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [data-shortcut-recorder]";

const SIDEBAR_LIST_OVERLAY_SELECTORS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
] as const;

let sidebarListArmed = false;

type ClosestNode = {
  closest: (selector: string) => unknown;
};

function asClosestNode(target: EventTarget | null | undefined): ClosestNode | null {
  if (!target || typeof target !== "object") return null;
  const candidate = target as { closest?: unknown; parentElement?: unknown };
  if (typeof candidate.closest === "function") {
    return candidate as ClosestNode;
  }
  const parent = candidate.parentElement as { closest?: unknown } | null;
  if (parent && typeof parent.closest === "function") {
    return parent as ClosestNode;
  }
  return null;
}

export function isSidebarPageListTarget(
  target: EventTarget | null | undefined,
): boolean {
  const element = asClosestNode(target);
  if (!element) return false;
  if (element.closest(SIDEBAR_LIST_EDITABLE_SELECTOR)) return false;
  return Boolean(element.closest(SIDEBAR_PAGE_LIST_SELECTOR));
}

export function armSidebarListCollapse(target: EventTarget | null): void {
  sidebarListArmed = isSidebarPageListTarget(target);
}

export function isSidebarListCollapseArmed(): boolean {
  return sidebarListArmed;
}

export function hasSidebarListEscapeOverlay(
  query: (selector: string) => Element | null = (selector) =>
    typeof document === "undefined" ? null : document.querySelector(selector),
): boolean {
  return SIDEBAR_LIST_OVERLAY_SELECTORS.some((selector) =>
    Boolean(query(selector)),
  );
}

export function shouldCollapseSidebarListOnEscape(event: {
  key: string;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}): boolean {
  if (event.defaultPrevented) return false;
  if (event.isComposing || event.repeat) return false;
  if (event.key !== "Escape") return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }
  if (hasSidebarListEscapeOverlay()) return false;
  return (
    sidebarListArmed || isSidebarPageListTarget(event.target)
  );
}

export type SidebarCollapsePage = {
  id: string;
  parentId?: string | null;
  workspaceId?: string;
  trashedAt?: number | null;
  localPendingCreate?: string;
};

const MAX_ANCESTOR_WALK = 1000;

function isUsableSidebarPage(
  page: SidebarCollapsePage | undefined,
  notebookId: string,
): page is SidebarCollapsePage {
  if (!page) return false;
  if (page.trashedAt) return false;
  if (page.localPendingCreate) return false;
  if (page.workspaceId && page.workspaceId !== notebookId) return false;
  return true;
}

/** 侧栏 Esc 收起时要露出的目标：选中行 > 焦点行 > 当前打开页。 */
export function resolveSidebarCollapseTargetId(
  notebookId: string,
  options: {
    selectedId?: string | null;
    focusedId?: string | null;
    activePageId?: string | null;
    pages: Record<string, SidebarCollapsePage>;
  },
): string | null {
  const candidates = [
    options.selectedId,
    options.focusedId,
    options.activePageId,
  ];
  for (const id of candidates) {
    if (!id || id === "root") continue;
    if (isUsableSidebarPage(options.pages[id], notebookId)) return id;
  }
  return null;
}

/**
 * 当前笔记要可见时必须展开的祖先（不含自身）。
 * 中途遇到已删、跨笔记本或环则停，避免把无效父级展开。
 */
export function collectSidebarRevealAncestorIds(
  pages: Record<string, SidebarCollapsePage>,
  pageId: string | null | undefined,
  notebookId: string,
): string[] {
  if (!pageId || pageId === "root") return [];
  const ids: string[] = [];
  const seen = new Set<string>([pageId]);
  let current = pages[pageId];
  for (let index = 0; index < MAX_ANCESTOR_WALK; index += 1) {
    const parentId = current?.parentId;
    if (!parentId || parentId === "root") break;
    if (seen.has(parentId)) break;
    const parent = pages[parentId];
    if (!isUsableSidebarPage(parent, notebookId)) break;
    seen.add(parentId);
    ids.push(parentId);
    current = parent;
  }
  return ids;
}

export function sameSidebarExpandedIds(
  current: readonly string[],
  next: readonly string[],
): boolean {
  if (current.length !== next.length) return false;
  const currentSet = new Set(current);
  return next.every((id) => currentSet.has(id));
}

export function computeSidebarEscapeExpandedIds(options: {
  notebookId: string;
  expandedIds: readonly string[];
  selectedId?: string | null;
  focusedId?: string | null;
  activePageId?: string | null;
  pages: Record<string, SidebarCollapsePage>;
}): { ids: string[]; changed: boolean; revealId: string | null } {
  const revealId = resolveSidebarCollapseTargetId(options.notebookId, options);
  const ids = collectSidebarRevealAncestorIds(
    options.pages,
    revealId,
    options.notebookId,
  );
  return {
    ids,
    changed: !sameSidebarExpandedIds(options.expandedIds, ids),
    revealId,
  };
}

export function collapseAllSidebarExpandedPages(
  notebookId: string | null | undefined,
): boolean {
  if (!notebookId) return false;
  const pagesState = usePages.getState();
  const view = useSidebarView.getState();
  const result = computeSidebarEscapeExpandedIds({
    notebookId,
    expandedIds: view.expandedByNotebook[notebookId] ?? [],
    selectedId: view.selectedByNotebook[notebookId] ?? null,
    focusedId: view.focusedByNotebook[notebookId] ?? null,
    activePageId: pagesState.activePageId,
    pages: pagesState.pages,
  });
  if (!result.changed) return false;
  view.setExpanded(notebookId, result.ids);
  if (result.revealId) pagesState.setExpandPageId(result.revealId);
  return true;
}

export function tryCollapseSidebarListOnEscape(
  event: {
    key: string;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    repeat?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    target?: EventTarget | null;
  },
  notebookId: string | null | undefined,
): boolean {
  if (!shouldCollapseSidebarListOnEscape(event)) return false;
  return collapseAllSidebarExpandedPages(notebookId);
}
