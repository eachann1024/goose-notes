import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { toast } from "@/components/ui/sonner";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
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
import {
  isLocalFolderDirectoryPage,
  isElectronLocalFolderDirectory,
  openPageFromSidebar,
  shouldSuppressSidebarSelect,
} from "@/lib/sidebarPageNavigation";
import { isPageTitleAutoFocusProtected } from "@/lib/page-title-focus";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { areSidebarPagesEqual } from "@/stores/pages/areSidebarPagesEqual";
import { MAIN_TREE_INDENT } from "./mainTreeDragGeometry";
import {
  clearLocalFolderDropParent,
  takeLocalFolderDropParent,
} from "./mainTreeLocalDrop";
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

const PENDING_CREATE_ID_PREFIX = "local-pending-";

function normalizePendingFileTitle(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "").trim();
}

function scheduleAfterMenuClose(action: () => void) {
  window.setTimeout(action, 0);
}

export function SidebarMainTree({
  activeNotebookId,
  selectedPageId,
  width,
  viewportHeight,
  itemHeight,
}: SidebarMainTreeProps) {
  const pages = useStoreWithEqualityFn(
    usePages,
    (s) => s.pages,
    areSidebarPagesEqual,
  );
  const activePageId = usePages((s) => s.activePageId);
  const reorderPages = usePages((s) => s.reorderPages);
  const moveLocalPage = usePages((s) => s.moveLocalPage);
  const createLocalFolderRecord = usePages((s) => s.createLocalFolderRecord);
  const createLocalPageRecord = usePages((s) => s.createLocalPageRecord);
  const getChildren = usePages((s) => s.getChildren);
  const expandPageId = usePages((s) => s.expandPageId);
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  const [pendingCreate, setPendingCreate] = useState<Page | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);
  const [pendingTreeSelection, setPendingTreeSelection] = useState<{
    notebookId: string;
    pageId: string;
    previousHighlightedPageId: string | null;
  } | null>(null);

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const localLoadState = useNotebooks((state) =>
    activeNotebookId
      ? state.localFolderLoadStates[activeNotebookId]
      : undefined,
  );
  const localLoadStatus = localLoadState?.status ?? "idle";
  // 已经加载过的本地库会在激活时后台重扫。保留这份树，既避免侧栏
  // 从完整内容闪成骨架屏，也让用户仍可在扫描期间看到上一次成功结果。
  // 首次载入没有缓存页面时仍完整展示 loading；真正失败则走下方错误态。
  const hasCachedLocalTree = Boolean(
    activeNotebookId &&
      Object.values(pages).some(
        (page) =>
          page.workspaceId === activeNotebookId &&
          !page.trashedAt &&
          !page.localUnsaved,
      ),
  );
  const shouldShowLocalSkeleton =
    isLocalFolder && localLoadStatus === "loading" && !hasCachedLocalTree;
  const localLoadError =
    isLocalFolder && localLoadStatus === "error"
      ? localLoadState?.error || "无法读取本地文件夹"
      : null;

  const retryLocalFolderLoad = useCallback(() => {
    if (!activeNotebookId || !notebook?.localPath) return;
    void usePages
      .getState()
      .loadLocalFolderPages(activeNotebookId, notebook.localPath)
      .catch((error) => {
        console.error("[local-folder] retry failed", error);
      });
  }, [activeNotebookId, notebook?.localPath]);

  // Subscribe so re-render propagates to renderItem/renderItemArrow closures
  useSettings((s) => s.hideExpandArrows);

  const expandedIds = useSidebarView(selectExpandedIds(activeNotebookId));
  const focusedId = useSidebarView(selectFocusedId(activeNotebookId));
  const selectedId = useSidebarView(selectSelectedId(activeNotebookId));
  const setExpanded = useSidebarView((s) => s.setExpanded);
  const expandView = useSidebarView((s) => s.expand);
  const collapseView = useSidebarView((s) => s.collapse);
  const toggleView = useSidebarView((s) => s.toggle);
  const setFocusedView = useSidebarView((s) => s.setFocused);
  const setSelectedView = useSidebarView((s) => s.setSelected);

  const highlightedPageId =
    selectedPageId !== undefined ? selectedPageId : activePageId;
  const pendingSelectedId =
    pendingTreeSelection?.notebookId === activeNotebookId
      ? pendingTreeSelection.pageId
      : null;

  const startCreateLocalItem = useCallback(
    (kind: "folder" | "file", parentId?: string) => {
      if (!activeNotebookId || !isLocalFolder) return;
      const parentPage = parentId ? pages[parentId] : undefined;
      const safeParentId = parentPage?.isFolder ? parentId : undefined;
      const pendingId = `${PENDING_CREATE_ID_PREFIX}${kind}-${Date.now()}`;
      const now = Date.now();
      const defaultTitle = kind === "folder" ? "新建文件夹" : "未命名";
      setPendingCreate({
        id: pendingId,
        workspaceId: activeNotebookId,
        parentId: safeParentId,
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: defaultTitle }],
            },
          ],
        },
        isFolder: kind === "folder",
        localPendingCreate: kind,
        isLocked: false,
        fontSize: "default",
        fontFamily: "default",
        createdAt: now,
        updatedAt: now,
        order: now,
      });
      if (safeParentId && !expandedIds.includes(safeParentId)) {
        expandView(activeNotebookId, safeParentId);
      }
    },
    [activeNotebookId, expandedIds, expandView, isLocalFolder, pages],
  );

  const startCreateLocalFolder = useCallback(
    (parentId?: string) => startCreateLocalItem("folder", parentId),
    [startCreateLocalItem],
  );

  const startCreateLocalFile = useCallback(
    (parentId?: string) => startCreateLocalItem("file", parentId),
    [startCreateLocalItem],
  );

  const cancelPendingCreate = useCallback((id: string) => {
    setPendingCreate((current) => (current?.id === id ? null : current));
  }, []);

  const commitPendingCreate = useCallback(
    (id: string, name: string) => {
      const current = pendingCreate;
      if (!current || current.id !== id || !activeNotebookId) return;
      const kind = current.localPendingCreate === "file" ? "file" : "folder";
      void (async () => {
        if (kind === "folder") {
          const createdId = await createLocalFolderRecord({
            workspaceId: activeNotebookId,
            parentId: current.parentId,
            title: name,
          });
          if (!createdId) {
            setPendingCreate((latest) => (latest?.id === id ? null : latest));
            toast.error("新建文件夹失败：名称冲突或文件系统错误");
            return;
          }
          setPendingCreate((latest) => (latest?.id === id ? null : latest));
          if (current.parentId) {
            expandView(activeNotebookId, current.parentId);
          }
          setExpandPageId(createdId);
          toast.success("已新建文件夹");
          return;
        }

        const createdId = await createLocalPageRecord({
          workspaceId: activeNotebookId,
          parentId: current.parentId,
          title: normalizePendingFileTitle(name) || "未命名",
        });
        if (!createdId) {
          setPendingCreate((latest) => (latest?.id === id ? null : latest));
          toast.error("新建文件失败：名称冲突或文件系统错误");
          return;
        }
        setPendingCreate((latest) => (latest?.id === id ? null : latest));
        if (current.parentId) {
          expandView(activeNotebookId, current.parentId);
        }
        usePages.getState().setActivePage(createdId);
        setExpandPageId(createdId);
        openPageFromSidebar(createdId, "preview");
      })();
    },
    [
      activeNotebookId,
      createLocalFolderRecord,
      createLocalPageRecord,
      expandView,
      pendingCreate,
      setExpandPageId,
    ],
  );

  const handleItemDragStart = useCallback(
    (id: string) => {
      draggingItemIdRef.current = id;
      setDraggingItemId(id);
      if (!activeNotebookId) return;
      setSelectedView(activeNotebookId, id);
      setPendingTreeSelection({
        notebookId: activeNotebookId,
        pageId: id,
        previousHighlightedPageId: highlightedPageId ?? null,
      });
    },
    [activeNotebookId, highlightedPageId, setSelectedView],
  );

  const handleItemDragEnd = useCallback(() => {
    draggingItemIdRef.current = null;
    setDraggingItemId(null);
    clearLocalFolderDropParent();
  }, []);

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
    return pagesToTreeItems(scopedPages, activeNotebookId, isLocalFolder);
  }, [scopedPages, activeNotebookId, isLocalFolder]);

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
  // react-complex-tree 的方向键默认只移动焦点，不会激活页面。
  // 仅记录从树内发起的上下导航，避免鼠标点击、自动定位和左右展开/折叠误触发切页。
  const verticalKeyboardNavigationRef = useRef(false);
  // 记录上一次已为之展开/定位的激活页，避免每次 render 重复 focus 打断用户
  const lastLocatedActiveIdRef = useRef<string | null>(null);

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
      if (isPageTitleAutoFocusProtected(expandPageId)) return;
      // 同步树的当前项/滚动即可；不要把编辑器、表格或输入框的 DOM 焦点
      // 强行夺到 react-complex-tree row overlay。
      treeRef.current?.focusItem(expandPageId, false);
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

  // 切标签 / 激活页变化时：自动展开当前页的祖先链并滚动定位
  // （选中高亮由 viewState.selectedItems 已处理；此处补「展开到可见 + 滚动」）
  useEffect(() => {
    if (!activePageId || !activeNotebookId) return;
    // 同一激活页只定位一次，避免重复 focus 打断用户的手动滚动/折叠
    if (lastLocatedActiveIdRef.current === activePageId) return;
    const page = pages[activePageId];
    if (!page || page.trashedAt) return;
    if (page.workspaceId !== activeNotebookId) return;
    lastLocatedActiveIdRef.current = activePageId;

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
      if (isPageTitleAutoFocusProtected(activePageId)) return;
      // 80ms 内用户可能已点进正文/table/input；此时仍展开和选中即可。
      // 第二参数 false 让 react-complex-tree 不抢回 DOM focus。
      treeRef.current?.focusItem(activePageId, false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activePageId, activeNotebookId, pages, expandedIds, setExpanded]);

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

  if (shouldShowLocalSkeleton) {
    return <LocalFolderLoadingSkeleton />;
  }
  if (localLoadError && !hasPages) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">
          本地文件夹加载失败
        </p>
        <p className="mt-1 max-w-52 text-xs leading-relaxed text-muted-foreground">
          {localLoadError}
        </p>
        <button
          type="button"
          onClick={retryLocalFolderLoad}
          className="mt-3 rounded-[8px] bg-[var(--goose-interactive-selected)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] focus-visible:ring-2 focus-visible:ring-ring"
        >
          重新加载
        </button>
      </div>
    );
  }
  if (!activeNotebookId || !hasPages) {
    const emptyState = (
      <TreeEmptyState
        isLocalNotebook={isLocalFolder}
        height={viewportHeight}
      />
    );
    if (!isLocalFolder || !activeNotebookId) {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col">{emptyState}</div>
      );
    }
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-h-0 w-full flex-1 flex-col outline-none">
            {emptyState}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="goose-sidebar-context-menu w-48"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ContextMenuGroup>
            <ContextMenuLabel className="px-1.5 py-1">
              新建
            </ContextMenuLabel>
            <ContextMenuItem
              onSelect={() =>
                scheduleAfterMenuClose(() => startCreateLocalFile(undefined))
              }
            >
              <LucideIcons.FilePlus2 className="h-4 w-4" />
              <span>新建文件</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                scheduleAfterMenuClose(() => startCreateLocalFolder(undefined))
              }
            >
              <LucideIcons.FolderPlus className="h-4 w-4" />
              <span>新建文件夹</span>
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
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
    if (isLocalFolder) {
      const captured = takeLocalFolderDropParent();
      if (captured !== null) {
        newParentId = captured;
        insertIndex = -1;
      } else if (target.targetType === "item") {
        const pid = String(target.targetItem);
        newParentId = pid === "root" ? undefined : pid;
        insertIndex = -1;
      } else if (target.targetType === "between-items") {
        const pid = String(target.parentItem);
        newParentId = pid === "root" ? undefined : pid;
        insertIndex = -1;
      } else {
        newParentId = undefined;
        insertIndex = -1;
      }
    } else if (target.targetType === "between-items") {
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

    if (
      newParentId &&
      dragIds.some((id) => id === newParentId || isAncestor(id, newParentId!))
    ) {
      return;
    }

    const keepDragSelection = () => {
      const keepId = dragIds[0];
      if (!keepId) return;
      setSelectedView(activeNotebookId, keepId);
      setPendingTreeSelection({
        notebookId: activeNotebookId,
        pageId: keepId,
        previousHighlightedPageId: highlightedPageId ?? null,
      });
    };

    // ── 本地文件夹：文件系统移动，无自定义排序 ────────────────────────────────
    if (isLocalFolder) {
      void (async () => {
        for (const id of dragIds) {
          try {
            await moveLocalPage(id, newParentId);
          } catch (err) {
            toast.error(`移动失败：${(err as Error).message ?? String(err)}`);
          }
        }
        if (newParentId && !expandedIds.includes(newParentId)) {
          expandView(activeNotebookId, newParentId);
        }
        keepDragSelection();
      })();
      return;
    }

    // ── Electron 内置模式：原有内存排序逻辑 ────────────────────────────────────
    const allChildren = getChildren(newParentId, activeNotebookId).map(
      (p) => p.id,
    );
    // rct 的 childIndex 基于含被拖项的原列表；过滤后 splice 前要补偿
    // 插入点之前被移除的项数，否则从上往下拖会偏后一位
    if (insertIndex > 0) {
      const removedBefore = dragIds.filter((id) => {
        const idx = allChildren.indexOf(id);
        return idx >= 0 && idx < insertIndex;
      }).length;
      insertIndex -= removedBefore;
    }
    const siblings = allChildren.filter((id) => !dragIds.includes(id));

    const finalIds =
      insertIndex < 0
        ? [...siblings, ...dragIds]
        : [
            ...siblings.slice(0, insertIndex),
            ...dragIds,
            ...siblings.slice(insertIndex),
          ];

    reorderPages(finalIds, newParentId);

    // 拖入成为子页面后自动展开新父级，让落点立即可见
    if (newParentId && !expandedIds.includes(newParentId)) {
      expandView(activeNotebookId, newParentId);
    }
    keepDragSelection();
  };

  return (
    <>
      {localLoadError && (
        <div
          className="mx-2 mb-1 flex items-center justify-between gap-2 rounded-[8px] bg-[var(--goose-color-danger-subtle-bg)] px-2.5 py-2 text-xs text-foreground"
          role="alert"
        >
          <span className="min-w-0 truncate" title={localLoadError}>
            文件夹刷新失败，仍显示上次内容
          </span>
          <button
            type="button"
            onClick={retryLocalFolderLoad}
            className="shrink-0 font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            重试
          </button>
        </div>
      )}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 min-h-0 overflow-auto"
            style={
              {
                width,
                height: viewportHeight || undefined,
                "--main-tree-row-height": `${itemHeight}px`,
              } as CSSProperties
            }
            onKeyDownCapture={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.matches("input, textarea") ||
                target.isContentEditable
              ) {
                return;
              }
              if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey
              ) {
                verticalKeyboardNavigationRef.current = true;
              }
            }}
            onKeyUpCapture={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                verticalKeyboardNavigationRef.current = false;
              }
            }}
            onMouseDown={(e) => {
              verticalKeyboardNavigationRef.current = false;
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
              if (!page) return;
              e.preventDefault();
              e.stopPropagation();
              if (isLocalFolderDirectoryPage(pageId)) {
                toggleLocalDirectory(pageId);
                if (isElectronLocalFolderDirectory(pageId)) return;
              }
              openPageFromSidebar(pageId, "permanent");
            }}
          >
            <ControlledTreeEnvironment<Page>
              items={items}
              getItemTitle={(item) =>
                item.index === "root" ? "" : getPageTitle(item.data)
              }
              viewState={viewState}
              defaultInteractionMode={InteractionMode.ClickArrowToExpand}
              canDragAndDrop={true}
              canReorderItems={true}
              canDropOnFolder={true}
              canDropOnNonFolder={false}
              renderDepthOffset={MAIN_TREE_INDENT}
              canRename={false}
              canSearch={false}
              canSearchByStartingTyping={false}
              canDropAt={(dragItems, target) => {
                const targetId =
                  target.targetType === "between-items"
                    ? String(target.parentItem)
                    : String((target as any).targetItem);
                if (targetId === "root") return true;
                const parentPage = pages[targetId];
                // 本地文件夹：落点父级必须是目录（或根）
                if (isLocalFolder && parentPage && !parentPage.isFolder)
                  return false;
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
                const pageId = String(item.index);
                setFocusedView(activeNotebookId, pageId);

                // 上下键沿 react-complex-tree 计算出的“当前可见节点”移动：
                // 展开时会进入子页面，折叠时会跳过整棵子树。
                if (!verticalKeyboardNavigationRef.current) return;
                verticalKeyboardNavigationRef.current = false;
                if (pageId === "root" || !pages[pageId]) return;
                if (isElectronLocalFolderDirectory(pageId)) return;
                setSelectedView(activeNotebookId, pageId);
                openPageFromSidebar(pageId, "preview");
              }}
              onSelectItems={(selected) => {
                if (!activeNotebookId) return;
                if (draggingItemIdRef.current) return;
                const last =
                  selected.length > 0
                    ? String(selected[selected.length - 1])
                    : null;
                if (
                  last &&
                  last !== "root" &&
                  isElectronLocalFolderDirectory(last)
                ) {
                  if (shouldSuppressSidebarSelect()) return;
                  setSelectedView(activeNotebookId, last);
                  return;
                }
                setSelectedView(activeNotebookId, last);
                if (!last || last === "root") return;
                if (shouldSuppressSidebarSelect()) return;
                const page = pages[last];
                if (!page) return;
                if (isLocalFolderDirectoryPage(last)) {
                  toggleLocalDirectory(last);
                }
                const { meta, ctrl } = lastClickModRef.current;
                if (meta || ctrl) {
                  openPageFromSidebar(last, "permanent");
                } else {
                  openPageFromSidebar(last, "preview");
                }
              }}
              onPrimaryAction={(item) => {
                const id = String(item.index);
                if (id === "root") return;
                if (isLocalFolderDirectoryPage(id)) {
                  toggleLocalDirectory(id);
                  if (isElectronLocalFolderDirectory(id)) return;
                }
                openPageFromSidebar(id, "preview");
              }}
              onDrop={handleDrop}
              renderItem={(args) =>
                renderItem({
                  ...args,
                  onCreateLocalFile: startCreateLocalFile,
                  onCreateLocalFolder: startCreateLocalFolder,
                  onCommitPendingCreate: commitPendingCreate,
                  onCancelPendingCreate: cancelPendingCreate,
                  onItemDragStart: handleItemDragStart,
                  onItemDragEnd: handleItemDragEnd,
                  onActivateLocalDirectory: activateLocalDirectory,
                })
              }
              renderItemArrow={renderItemArrow}
              renderItemsContainer={renderItemsContainer}
              renderTreeContainer={renderTreeContainer}
              renderDragBetweenLine={renderDragBetweenLine}
            >
              <Tree
                treeId="main"
                rootItem="root"
                treeLabel="页面"
                ref={treeRef}
              />
            </ControlledTreeEnvironment>
          </div>
        </ContextMenuTrigger>
        {isLocalFolder && activeNotebookId && (
          <ContextMenuContent
            className="goose-sidebar-context-menu w-48"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <ContextMenuGroup>
              <ContextMenuLabel className="px-1.5 py-1">
                新建
              </ContextMenuLabel>
              <ContextMenuItem
                onSelect={() =>
                  scheduleAfterMenuClose(() => startCreateLocalFile(undefined))
                }
              >
                <LucideIcons.FilePlus2 className="h-4 w-4" />
                <span>新建文件</span>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() =>
                  scheduleAfterMenuClose(() =>
                    startCreateLocalFolder(undefined),
                  )
                }
              >
                <LucideIcons.FolderPlus className="h-4 w-4" />
                <span>新建文件夹</span>
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        )}
      </ContextMenu>
    </>
  );
}
