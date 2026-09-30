import * as GooseIcons from "@/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ControlledTreeEnvironment,
  InteractionMode,
  Tree,
  type DraggingPosition,
  type TreeItem,
  type TreeItemIndex,
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
import { MainTreeEdgeDropWatcher } from "./MainTreeEdgeDropWatcher";
import {
  mainTreeEdgeDropTarget,
  type MainTreeEdgeZone,
} from "./mainTreeEdgeDrop";
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
import { useSidebarPageReveal } from "./useSidebarPageReveal";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { areSidebarPagesEqual } from "@/stores/pages/areSidebarPagesEqual";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { formatShortcut } from "@/lib/utils";
import { MAIN_TREE_INDENT } from "./mainTreeDragGeometry";
import {
  LOCAL_FOLDER_ROOT_DIR_KEY,
  applyLocalFolderReorder,
  clearLocalFolderOrder,
  insertLocalFolderOrder,
  useLocalFolderManualOrder,
  useLocalFolderOrders,
} from "@/stores/localFolderOrder";
import "./main-tree.css";

interface SidebarMainTreeProps {
  activeNotebookId: string | null;
  selectedPageId?: string | null;
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

function MenuShortcut({ shortcut }: { shortcut: string }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
      {formatShortcut(shortcut)}
    </span>
  );
}

export function SidebarMainTree({
  activeNotebookId,
  selectedPageId,
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
  // 本地文件夹手动顺序：拖动排序 / 恢复名称排序后靠它触发树重建
  const localFolderOrders = useLocalFolderOrders((s) =>
    activeNotebookId ? s.ordersByNotebook[activeNotebookId] : undefined,
  );
  const rootHasManualOrder = useLocalFolderManualOrder(
    activeNotebookId,
    LOCAL_FOLDER_ROOT_DIR_KEY,
  );
  // 根目录进入手动排序后给个恢复入口（树容器与空状态两个右键菜单共用）
  const rootOrderMenuGroup = rootHasManualOrder ? (
    <ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() =>
          scheduleAfterMenuClose(() => {
            if (!activeNotebookId) return;
            // 写盘失败时 clearLocalFolderOrder 自己会报错，不要谎报成功
            if (
              clearLocalFolderOrder(activeNotebookId, LOCAL_FOLDER_ROOT_DIR_KEY)
            ) {
              toast.success("已恢复名称排序");
            }
          })
        }
      >
        <GooseIcons.ArrowDownAZ className="h-4 w-4" />
        <span>恢复名称排序</span>
      </ContextMenuItem>
    </ContextMenuGroup>
  ) : null;
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
          className="mt-3 rounded-[8px] bg-[var(--goose-interactive-selected)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] "
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
              <GooseIcons.FilePlus2 className="h-4 w-4" />
              <span className="min-w-0 truncate">新建文件</span>
              <MenuShortcut shortcut={getFixedAppShortcuts().newNote} />
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                scheduleAfterMenuClose(() => startCreateLocalFolder(undefined))
              }
            >
              <GooseIcons.FolderPlus className="h-4 w-4" />
              <span>新建文件夹</span>
            </ContextMenuItem>
          </ContextMenuGroup>
          {rootOrderMenuGroup}
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
    // 父级与插入索引必须来自同一落点，不能再用悬停行的目录覆盖父级。
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

    // ── 本地文件夹：同目录内落点 = 该目录手动排序；其余落点 = 文件系统移动 ──────
    if (isLocalFolder) {
      const sameDirDrop = dragIds.every(
        (id) => usePages.getState().pages[id]?.parentId === newParentId,
      );
      if (target.targetType === "between-items" && sameDirDrop) {
        const siblings = getChildren(newParentId, activeNotebookId).filter(
          (page) => !page.localUnsaved,
        );
        if (
          applyLocalFolderReorder(
            activeNotebookId,
            newParentId ?? LOCAL_FOLDER_ROOT_DIR_KEY,
            siblings,
            dragIds,
            target.childIndex,
          )
        ) {
          // 首次有效同目录拖动：该目录切为手动顺序，落点即新位置
          keepDragSelection();
          return;
        }
      }

      void (async () => {
        const movedIds: string[] = [];
        for (const id of dragIds) {
          try {
            await moveLocalPage(id, newParentId);
            movedIds.push(id);
          } catch (err) {
            toast.error(`移动失败：${(err as Error).message ?? String(err)}`);
          }
        }
        // 跨目录移动成功后补落点：文件系统移动本身不表达位置，同目录那种
        // applyLocalFolderReorder 又只在同目录才走。edge 顶部 childIndex 为 0、
        // 底部为根子项数，都按目标目录落点插入，否则一律被追加到末尾。
        if (!sameDirDrop && insertIndex >= 0 && movedIds.length > 0) {
          insertLocalFolderOrder(
            activeNotebookId,
            newParentId ?? LOCAL_FOLDER_ROOT_DIR_KEY,
            getChildren(newParentId, activeNotebookId).filter(
              (page) => !page.localUnsaved,
            ),
            movedIds,
            insertIndex,
          );
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

  const handleMainTreeEdgeDrop = (
    zone: MainTreeEdgeZone,
    item: TreeItem<Page>,
  ) => {
    handleDrop([item], mainTreeEdgeDropTarget(zone, rootChildren.length));
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
            className="shrink-0 font-medium underline underline-offset-2 "
          >
            重试
          </button>
        </div>
      )}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 min-w-0 w-full overflow-auto"
            style={
              {
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
              openPageFromSidebar(pageId, "permanent", { newTab: true });
            }}
          >
            <MainTreeEdgeDropWatcher
              containerRef={scrollContainerRef}
              draggingItemId={draggingItemId}
              draggedItem={
                draggingItemId ? items[draggingItemId] : undefined
              }
              onEdgeDrop={handleMainTreeEdgeDrop}
            />
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
                  openPageFromSidebar(last, "permanent", { newTab: true });
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
                <GooseIcons.FilePlus2 className="h-4 w-4" />
                <span className="min-w-0 truncate">新建文件</span>
                <MenuShortcut shortcut={getFixedAppShortcuts().newNote} />
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() =>
                  scheduleAfterMenuClose(() =>
                    startCreateLocalFolder(undefined),
                  )
                }
              >
                <GooseIcons.FolderPlus className="h-4 w-4" />
                <span>新建文件夹</span>
              </ContextMenuItem>
            </ContextMenuGroup>
            {rootOrderMenuGroup}
          </ContextMenuContent>
        )}
      </ContextMenu>
    </>
  );
}
