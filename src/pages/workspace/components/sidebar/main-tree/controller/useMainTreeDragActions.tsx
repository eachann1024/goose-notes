import { type DraggingPosition, type TreeItem } from "react-complex-tree";
import type { Page } from "@/types";
import { toast } from "@/components/ui/sonner";
import {
  mainTreeEdgeDropTarget,
  type MainTreeEdgeZone,
} from "../mainTreeEdgeDrop";
import {
  LOCAL_FOLDER_ROOT_DIR_KEY,
  applyLocalFolderReorder,
  insertLocalFolderOrder,
} from "@/stores/localFolderOrder";
import type { useMainTreeView } from "./useMainTreeView";

export function useMainTreeDragActions(
  input: ReturnType<typeof useMainTreeView>,
) {
  const {
    activeNotebookId,
    pages,
    reorderPages,
    moveLocalPage,
    getChildren,
    setPendingTreeSelection,
    isLocalFolder,
    expandedIds,
    expandView,
    setSelectedView,
    highlightedPageId,
    rootChildren,
    isAncestor,
  } = input;

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
  return { ...input, handleDrop, handleMainTreeEdgeDrop };
}
