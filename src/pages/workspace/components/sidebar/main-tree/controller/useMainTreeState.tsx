import * as GooseIcons from "@/components/ui/icons";
import { useCallback, useRef, useState } from "react";
import type { Page } from "@/types";
import { toast } from "@/components/ui/sonner";
import { useNotebooks } from "@/stores/useNotebooks";
import {
  useSidebarView,
  selectExpandedIds,
  selectFocusedId,
  selectSelectedId,
} from "@/stores/useSidebarView";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { areSidebarPagesEqual } from "@/stores/pages/areSidebarPagesEqual";
import {
  LOCAL_FOLDER_ROOT_DIR_KEY,
  clearLocalFolderOrder,
  useLocalFolderManualOrder,
  useLocalFolderOrders,
} from "@/stores/localFolderOrder";
import { type SidebarMainTreeProps, scheduleAfterMenuClose } from "./shared";

export function useMainTreeState({
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
  return {
    activeNotebookId,
    selectedPageId,
    viewportHeight,
    itemHeight,
    pages,
    activePageId,
    reorderPages,
    moveLocalPage,
    createLocalFolderRecord,
    createLocalPageRecord,
    getChildren,
    expandPageId,
    setExpandPageId,
    localFolderOrders,
    rootHasManualOrder,
    rootOrderMenuGroup,
    pendingCreate,
    setPendingCreate,
    draggingItemId,
    setDraggingItemId,
    draggingItemIdRef,
    pendingTreeSelection,
    setPendingTreeSelection,
    notebook,
    isLocalFolder,
    localLoadState,
    localLoadStatus,
    hasCachedLocalTree,
    shouldShowLocalSkeleton,
    localLoadError,
    retryLocalFolderLoad,
    expandedIds,
    focusedId,
    selectedId,
    setExpanded,
    expandView,
    collapseView,
    toggleView,
    setFocusedView,
    setSelectedView,
    highlightedPageId,
    pendingSelectedId,
  };
}
