import { renderMainTreeSurface } from "./controller/renderMainTreeSurface";
import * as GooseIcons from "@/components/ui/icons";
import { LocalFolderLoadingSkeleton } from "../LocalFolderLoadingSkeleton";
import { TreeEmptyState } from "../tree/TreeEmptyState";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import "./main-tree.css";
import {
  type SidebarMainTreeProps,
  scheduleAfterMenuClose,
  MenuShortcut,
} from "./controller/shared";
import { useMainTreeState } from "./controller/useMainTreeState";
import { useMainTreeLocalCreation } from "./controller/useMainTreeLocalCreation";
import { useMainTreeView } from "./controller/useMainTreeView";
import { useMainTreeDragActions } from "./controller/useMainTreeDragActions";

export function SidebarMainTree(props: SidebarMainTreeProps) {
  const tree = useMainTreeState(props);
  const creation = useMainTreeLocalCreation(tree);
  const view = useMainTreeView(creation);
  const mainTreeDragActionsContext = useMainTreeDragActions(view);
  const context = mainTreeDragActionsContext;
  const {
    activeNotebookId,
    viewportHeight,
    rootOrderMenuGroup,
    isLocalFolder,
    shouldShowLocalSkeleton,
    localLoadError,
    retryLocalFolderLoad,
    startCreateLocalFolder,
    startCreateLocalFile,
    hasPages,
  } = context;

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
      <TreeEmptyState isLocalNotebook={isLocalFolder} height={viewportHeight} />
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
            <ContextMenuLabel className="px-1.5 py-1">新建</ContextMenuLabel>
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
        {renderMainTreeSurface(context)}
        {isLocalFolder && activeNotebookId && (
          <ContextMenuContent
            className="goose-sidebar-context-menu w-48"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <ContextMenuGroup>
              <ContextMenuLabel className="px-1.5 py-1">新建</ContextMenuLabel>
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
