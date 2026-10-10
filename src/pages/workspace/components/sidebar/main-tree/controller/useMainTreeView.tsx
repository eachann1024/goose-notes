import { useCallback, useEffect, useMemo, useRef } from "react";
import { type TreeItem, type TreeItemIndex } from "react-complex-tree";
import type { Page } from "@/types";
import { pagesToTreeItems } from "../treeAdapter";
import {
  isLocalFolderDirectoryPage,
  isElectronLocalFolderDirectory,
  openPageFromSidebar,
} from "@/lib/sidebarPageNavigation";
import { useSidebarPageReveal } from "../useSidebarPageReveal";
import type { useMainTreeLocalCreation } from "./useMainTreeLocalCreation";

export function useMainTreeView(
  input: ReturnType<typeof useMainTreeLocalCreation>,
) {
  const {
    activeNotebookId,
    pages,
    expandPageId,
    setExpandPageId,
    localFolderOrders,
    pendingCreate,
    draggingItemId,
    pendingTreeSelection,
    setPendingTreeSelection,
    isLocalFolder,
    shouldShowLocalSkeleton,
    expandedIds,
    focusedId,
    selectedId,
    setExpanded,
    toggleView,
    setSelectedView,
    highlightedPageId,
    pendingSelectedId,
  } = input;

  const scopedPages = useMemo(() => {
    const list = Object.values(pages);
    if (
      pendingCreate &&
      activeNotebookId &&
      pendingCreate.workspaceId === activeNotebookId
    ) {
      return [...list, pendingCreate];
    }
    return list;
  }, [activeNotebookId, pages, pendingCreate]);

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
      scopedPages,
      activeNotebookId,
      isLocalFolder,
      localFolderOrders,
    );
  }, [scopedPages, activeNotebookId, isLocalFolder, localFolderOrders]);

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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const lastClickModRef = useRef({ meta: false, ctrl: false });

  // react-complex-tree 的方向键默认只移动焦点，不会激活页面。
  // 仅记录从树内发起的上下导航，避免鼠标点击、自动定位和左右展开/折叠误触发切页。
  const verticalKeyboardNavigationRef = useRef(false);

  const viewState = useMemo(() => {
    const highlightSelection =
      draggingItemId && items[draggingItemId]
        ? [draggingItemId]
        : pendingSelectedId && items[pendingSelectedId]
          ? [pendingSelectedId]
          : highlightedPageId && items[highlightedPageId]
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
  }, [
    draggingItemId,
    expandedIds,
    focusedId,
    selectedId,
    highlightedPageId,
    pendingSelectedId,
    items,
  ]);

  useEffect(() => {
    if (!pendingTreeSelection) return;
    if (pendingTreeSelection.notebookId !== activeNotebookId) {
      setPendingTreeSelection(null);
      return;
    }
    // 页面切换会在标签激活后异步写入 activePageId。树先沿用本次点击的选择；
    // 目标页落定后撤掉临时态。若期间跳到了第三个页面，则以新导航为准。
    if (
      highlightedPageId === pendingTreeSelection.pageId ||
      (highlightedPageId !== pendingTreeSelection.previousHighlightedPageId &&
        highlightedPageId !== pendingTreeSelection.pageId)
    ) {
      setPendingTreeSelection(null);
    }
  }, [activeNotebookId, highlightedPageId, pendingTreeSelection]);

  const consumeRevealRequest = useCallback((pageId: string) => {
    const store = usePages.getState();
    if (store.expandPageId === pageId) store.setExpandPageId(null);
  }, []);

  useSidebarPageReveal({
    activeNotebookId,
    highlightedPageId,
    expandPageId,
    pages,
    expandedIds,
    treeReady: hasPages && !shouldShowLocalSkeleton,
    scrollContainerRef,
    setExpanded,
    consumeRequest: consumeRevealRequest,
  });

  const toggleLocalDirectory = useCallback(
    (pageId: string) => {
      if (!activeNotebookId || !isLocalFolderDirectoryPage(pageId)) return;
      toggleView(activeNotebookId, pageId);
    },
    [activeNotebookId, toggleView],
  );

  const activateLocalDirectory = useCallback(
    (pageId: string, mode: "preview" | "permanent") => {
      if (!activeNotebookId || !isLocalFolderDirectoryPage(pageId)) return;
      // Electron：文件夹不进主区，只由行点击负责展开/收起。
      if (isElectronLocalFolderDirectory(pageId)) return;
      // activePageId 会等标签切换链完成后才更新；先建立本次点击的即时视觉选择，
      // 避免展开挂载子项时旧 activePageId 让旧子项闪现高亮。
      setPendingTreeSelection({
        notebookId: activeNotebookId,
        pageId,
        previousHighlightedPageId: highlightedPageId ?? null,
      });
      setSelectedView(activeNotebookId, pageId);
      openPageFromSidebar(pageId, mode);
    },
    [activeNotebookId, highlightedPageId, setSelectedView],
  );
  return {
    ...input,
    scopedPages,
    items,
    rootChildren,
    hasPages,
    isAncestor,
    scrollContainerRef,
    lastClickModRef,
    verticalKeyboardNavigationRef,
    viewState,
    consumeRevealRequest,
    toggleLocalDirectory,
    activateLocalDirectory,
  };
}
