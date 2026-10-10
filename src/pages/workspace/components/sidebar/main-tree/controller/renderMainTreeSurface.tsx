import { type CSSProperties } from "react";
import {
  ControlledTreeEnvironment,
  InteractionMode,
  Tree,
} from "react-complex-tree";
import type { Page } from "@/types";
import { MainTreeEdgeDropWatcher } from "../MainTreeEdgeDropWatcher";
import { getPageTitle } from "../treeAdapter";
import {
  renderItem,
  renderItemArrow,
  renderItemsContainer,
  renderTreeContainer,
  renderDragBetweenLine,
} from "../MainTreeItem";
import {
  isLocalFolderDirectoryPage,
  isElectronLocalFolderDirectory,
  openPageFromSidebar,
  shouldSuppressSidebarSelect,
} from "@/lib/sidebarPageNavigation";
import { MAIN_TREE_INDENT } from "../mainTreeDragGeometry";
import type { useMainTreeDragActions } from "./useMainTreeDragActions";

export function renderMainTreeSurface(
  context: ReturnType<typeof useMainTreeDragActions>,
) {
  const {
    activeNotebookId,
    viewportHeight,
    itemHeight,
    pages,
    draggingItemId,
    draggingItemIdRef,
    isLocalFolder,
    expandView,
    collapseView,
    setFocusedView,
    setSelectedView,
    startCreateLocalFolder,
    startCreateLocalFile,
    cancelPendingCreate,
    commitPendingCreate,
    handleItemDragStart,
    handleItemDragEnd,
    items,
    isAncestor,
    scrollContainerRef,
    lastClickModRef,
    verticalKeyboardNavigationRef,
    viewState,
    toggleLocalDirectory,
    activateLocalDirectory,
    handleDrop,
    handleMainTreeEdgeDrop,
  } = context;
  return (
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
          if (target.matches("input, textarea") || target.isContentEditable) {
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
          draggedItem={draggingItemId ? items[draggingItemId] : undefined}
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
          <Tree treeId="main" rootItem="root" treeLabel="页面" />
        </ControlledTreeEnvironment>
      </div>
    </ContextMenuTrigger>
  );
}
