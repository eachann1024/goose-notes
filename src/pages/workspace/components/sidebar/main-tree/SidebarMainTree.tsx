import { useEffect, useMemo, useRef } from "react";
import {
  ControlledTreeEnvironment,
  InteractionMode,
  Tree,
  type DraggingPosition,
  type TreeItem,
  type TreeItemIndex,
  type TreeRef,
} from "react-complex-tree";
import type { Page } from "@/types";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { CLOSE_AI_WORKSPACE_EVENT } from "../../ai/events";
import {
  useSidebarView,
  selectExpandedIds,
  selectFocusedId,
  selectSelectedId,
} from "@/stores/useSidebarView";
import { LocalFolderLoadingSkeleton } from "../LocalFolderLoadingSkeleton";
import { TreeEmptyState } from "../tree/TreeEmptyState";
import { pagesToTreeItems, getPageTitle } from "./treeAdapter";
import {
  renderItem,
  renderItemArrow,
  renderItemsContainer,
  renderTreeContainer,
  renderDragBetweenLine,
} from "./MainTreeItem";
import "./main-tree.css";

interface SidebarMainTreeProps {
  activeNotebookId: string | null;
  selectedPageId?: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
}

export function SidebarMainTree({
  activeNotebookId,
  selectedPageId,
  width,
  viewportHeight,
  onCreatePage,
}: SidebarMainTreeProps) {
  const pages = usePages((s) => s.pages);
  const activePageId = usePages((s) => s.activePageId);
  const reorderPages = usePages((s) => s.reorderPages);
  const getChildren = usePages((s) => s.getChildren);
  const setActivePage = usePages((s) => s.setActivePage);
  const expandPageId = usePages((s) => s.expandPageId);
  const setExpandPageId = usePages((s) => s.setExpandPageId);

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const localLoadStatus = useNotebooks((state) =>
    activeNotebookId
      ? state.localFolderLoadStates[activeNotebookId]?.status ?? "idle"
      : "idle",
  );
  const shouldShowLocalSkeleton =
    isLocalFolder && localLoadStatus === "loading";

  const expandedIds = useSidebarView(selectExpandedIds(activeNotebookId));
  const focusedId = useSidebarView(selectFocusedId(activeNotebookId));
  const selectedId = useSidebarView(selectSelectedId(activeNotebookId));
  const setExpanded = useSidebarView((s) => s.setExpanded);
  const expandView = useSidebarView((s) => s.expand);
  const collapseView = useSidebarView((s) => s.collapse);
  const setFocusedView = useSidebarView((s) => s.setFocused);
  const setSelectedView = useSidebarView((s) => s.setSelected);

  const highlightedPageId =
    selectedPageId !== undefined ? selectedPageId : activePageId;

  const items = useMemo<Record<TreeItemIndex, TreeItem<Page>>>(() => {
    if (!activeNotebookId) {
      return {
        root: {
          index: "root",
          children: [],
          isFolder: true,
          data: {} as Page,
          canMove: false,
          canRename: false,
        },
      };
    }
    return pagesToTreeItems(
      Object.values(pages),
      activeNotebookId,
      isLocalFolder,
    );
  }, [pages, activeNotebookId, isLocalFolder]);

  const rootChildren = items.root?.children ?? [];
  const hasPages = rootChildren.length > 0;

  const isAncestor = (ancestorId: string, descendantId: string) => {
    let pid: string | undefined = pages[descendantId]?.parentId;
    while (pid) {
      if (pid === ancestorId) return true;
      pid = pages[pid]?.parentId;
    }
    return false;
  };

  const treeRef = useRef<TreeRef>(null);
  const lastClickModRef = useRef({ meta: false, ctrl: false });

  const viewState = useMemo(() => {
    const highlightSelection =
      highlightedPageId && items[highlightedPageId]
        ? [highlightedPageId]
        : selectedId
          ? [selectedId]
          : [];
    return {
      main: {
        expandedItems: expandedIds,
        selectedItems: highlightSelection as TreeItemIndex[],
        focusedItem: (focusedId ?? undefined) as TreeItemIndex | undefined,
      },
    };
  }, [expandedIds, focusedId, selectedId, highlightedPageId, items]);

  useEffect(() => {
    if (!expandPageId || !activeNotebookId) return;
    const page = pages[expandPageId];
    if (!page) return;
    if (page.trashedAt) {
      setExpandPageId(null);
      return;
    }
    if (page.workspaceId !== activeNotebookId) return;

    const ancestorIds: string[] = [];
    let current: Page | undefined = page;
    while (current && current.parentId && pages[current.parentId]) {
      ancestorIds.push(current.parentId);
      current = pages[current.parentId];
    }
    if (ancestorIds.length > 0) {
      const merged = Array.from(new Set([...expandedIds, ...ancestorIds]));
      setExpanded(activeNotebookId, merged);
    }
    const timer = window.setTimeout(() => {
      treeRef.current?.focusItem(expandPageId);
    }, 80);
    setExpandPageId(null);
    return () => window.clearTimeout(timer);
  }, [
    expandPageId,
    pages,
    activeNotebookId,
    expandedIds,
    setExpanded,
    setExpandPageId,
  ]);

  if (shouldShowLocalSkeleton) {
    return <LocalFolderLoadingSkeleton />;
  }
  if (!activeNotebookId || !hasPages) {
    return (
      <TreeEmptyState
        isLocalNotebook={isLocalFolder}
        width={width}
        onCreatePage={onCreatePage}
      />
    );
  }

  const handleDrop = (
    droppedItems: TreeItem<Page>[],
    target: DraggingPosition,
  ) => {
    if (!activeNotebookId) return;
    const dragIds = droppedItems
      .map((it) => String(it.index))
      .filter((id) => id !== "root");
    if (dragIds.length === 0) return;

    let newParentId: string | undefined;
    let insertIndex: number;
    if (target.targetType === "between-items") {
      const pid = String(target.parentItem);
      newParentId = pid === "root" ? undefined : pid;
      insertIndex = target.childIndex;
    } else if (target.targetType === "item") {
      const pid = String(target.targetItem);
      newParentId = pid === "root" ? undefined : pid;
      insertIndex = -1;
    } else {
      newParentId = undefined;
      insertIndex = -1;
    }

    if (newParentId && dragIds.some((id) => id === newParentId || isAncestor(id, newParentId!))) {
      return;
    }

    const siblings = getChildren(newParentId, activeNotebookId)
      .map((p) => p.id)
      .filter((id) => !dragIds.includes(id));

    const finalIds =
      insertIndex < 0
        ? [...siblings, ...dragIds]
        : [
            ...siblings.slice(0, insertIndex),
            ...dragIds,
            ...siblings.slice(insertIndex),
          ];

    reorderPages(finalIds, newParentId);
  };

  const canDragHandler = isLocalFolder ? () => false : undefined;

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ width, height: viewportHeight || undefined }}
      onMouseDown={(e) => {
        lastClickModRef.current = { meta: e.metaKey, ctrl: e.ctrlKey };
      }}
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        const target = e.target as HTMLElement;
        const row = target.closest("[data-rct-item-id]");
        if (!row) return;
        const pageId = row.getAttribute("data-rct-item-id");
        if (!pageId || pageId === "root") return;
        const page = pages[pageId];
        if (!page || (isLocalFolder && page.isFolder)) return;
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
        useTabs.getState().openTab(pageId);
      }}
    >
      <ControlledTreeEnvironment<Page>
        items={items}
        getItemTitle={(item) =>
          item.index === "root" ? "" : getPageTitle(item.data)
        }
        viewState={viewState}
        defaultInteractionMode={InteractionMode.ClickArrowToExpand}
        canDragAndDrop={!isLocalFolder}
        canReorderItems={!isLocalFolder}
        canDropOnFolder={!isLocalFolder}
        canDropOnNonFolder={false}
        canRename={false}
        canDrag={canDragHandler}
        canDropAt={(dragItems, target) => {
          if (isLocalFolder) return false;
          const targetId =
            target.targetType === "between-items"
              ? String(target.parentItem)
              : String((target as any).targetItem);
          if (targetId === "root") return true;
          return !dragItems.some((it) => {
            const id = String(it.index);
            return id === targetId || isAncestor(id, targetId);
          });
        }}
        onExpandItem={(item) => {
          if (!activeNotebookId) return;
          expandView(activeNotebookId, String(item.index));
        }}
        onCollapseItem={(item) => {
          if (!activeNotebookId) return;
          collapseView(activeNotebookId, String(item.index));
        }}
        onFocusItem={(item) => {
          if (!activeNotebookId) return;
          setFocusedView(activeNotebookId, String(item.index));
        }}
        onSelectItems={(selected) => {
          if (!activeNotebookId) return;
          const last = selected.length > 0 ? String(selected[selected.length - 1]) : null;
          setSelectedView(activeNotebookId, last);
          if (!last || last === "root") return;
          const page = pages[last];
          if (!page) return;
          if (isLocalFolder && page.isFolder) return;
          window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
          const { meta, ctrl } = lastClickModRef.current;
          if (meta || ctrl) {
            useTabs.getState().openTab(last);
          } else {
            if (activePageId === last) return;
            useTabs.getState().openInCurrentTab(last);
            setActivePage(last);
          }
        }}
        onPrimaryAction={(item) => {
          const id = String(item.index);
          if (id === "root") return;
          const page = item.data;
          if (isLocalFolder && page?.isFolder) {
            if (!activeNotebookId) return;
            if (expandedIds.includes(id)) {
              collapseView(activeNotebookId, id);
            } else {
              expandView(activeNotebookId, id);
            }
            return;
          }
          window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
          useTabs.getState().openInCurrentTab(id);
          setActivePage(id);
        }}
        onDrop={handleDrop}
        renderItem={renderItem}
        renderItemArrow={renderItemArrow}
        renderItemsContainer={renderItemsContainer}
        renderTreeContainer={renderTreeContainer}
        renderDragBetweenLine={renderDragBetweenLine}
      >
        <Tree treeId="main" rootItem="root" treeLabel="页面" ref={treeRef} />
      </ControlledTreeEnvironment>
    </div>
  );
}
