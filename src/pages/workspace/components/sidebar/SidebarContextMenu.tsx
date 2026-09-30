import type { Page } from "@/types";
import {
  deletePageWithUndo,
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { formatShortcut } from "@/lib/utils";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { useSettings } from "@/stores/useSettings";
import { shell } from "@/lib/utools/shell";
import { toast } from "sonner";

const _platform = navigator.platform || navigator.userAgent;
const _isMac = /Mac/i.test(_platform);
const _isWin = /Win/i.test(_platform);
function getFinderLabel(isFolder: boolean) {
  const action = isFolder ? "打开" : "显示";
  if (_isMac) return `在访达中${action}`;
  if (_isWin) return `在资源管理器中${action}`;
  return `在文件管理器中${action}`;
}

interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
}

export function SidebarContextMenu({
  page,
  children,
}: SidebarContextMenuProps) {
  const {
    updatePage,
    movePageTreeToNotebook,
    undoMovePageTree,
  } = usePages();
  const notebooks = useNotebooks((state) => state.notebooks);
  const notebook = notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const isTrashed = !!page.trashedAt;
  const menuLabel = isLocalFolder
    ? page.isFolder
      ? "本地文件夹"
      : "本地文件"
    : "页面";
  const movableNotebooks = Object.values(notebooks).filter(
    (item) => item.id !== page.workspaceId && item.source !== "local-folder",
  );

  const toggleFavorite = () => {
    updatePage(page.id, { isFavorite: !page.isFavorite });
  };

  const togglePinned = () => {
    updatePage(page.id, { isPinned: !page.isPinned });
  };

  const handleMoveToTopLevel = () => {
    updatePage(page.id, { parentId: undefined });
  };

  const handleRestore = () => restorePageWithToast(page.id);

  const handleMoveToNotebook = (targetNotebookId: string) => {
    const result = movePageTreeToNotebook(page.id, targetNotebookId);
    if (!result.ok) {
      if (result.reason === "same-notebook") {
        toast.error("页面已在当前记事本");
      } else if (result.reason === "target-not-supported") {
        toast.error("目标记事本不支持移动");
      } else {
        toast.error("移动失败，请重试");
      }
      return;
    }

    const targetNotebook = notebooks[targetNotebookId];
    const targetName = targetNotebook?.name || "目标记事本";
    toast.success(`已移动到「${targetName}」`, {
      description: `共移动 ${result.movedCount} 个页面`,
      duration: 5000,
      action: {
        label: "撤回",
        onClick: () => {
          const ok = undoMovePageTree(
            result.undoSnapshots,
            result.sourceNotebookId,
            result.prevActivePageId,
          );
          if (!ok) {
            toast.error("撤回失败：源记事本不存在");
          }
        },
      },
    });
  };

  const localFolderExternalEditor = useSettings((s) => s.localFolderExternalEditor);
  const hasParent = !!page.parentId;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild className="w-full">
          <div data-goose-context-trigger="true" className="h-full w-full">
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60 !border-0">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground/50">
            {menuLabel}
          </div>
          <ContextMenuItem
            onSelect={() => {
              if (isTrashed) return;
              useTabs.getState().openTab(page.id);
            }}
            disabled={isTrashed}
          >
            <LucideIcons.PanelTopOpen className="h-4 w-4" />
            <span>在新标签页打开</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatShortcut("Mod")}+点击
            </span>
          </ContextMenuItem>
          {isLocalFolder && !isTrashed && page.localFilePath && !page.isFolder && (
            <ContextMenuItem
              onSelect={() => {
                void shell.openWithEditor(page.localFilePath!, localFolderExternalEditor).then((ok) => {
                  if (!ok) toast.error("打开失败，请检查外部编辑器设置");
                });
              }}
            >
              <LucideIcons.SquareArrowOutUpRight className="h-4 w-4" />
              <span>用外部编辑器打开</span>
            </ContextMenuItem>
          )}
          {isLocalFolder && !isTrashed && page.localFilePath && (
            <ContextMenuItem
              onSelect={() => {
                if (page.isFolder) {
                  void shell.openPath(page.localFilePath!);
                } else {
                  void shell.showItemInFolder(page.localFilePath!);
                }
              }}
            >
              <LucideIcons.FolderOpen className="h-4 w-4" />
              <span>{getFinderLabel(!!page.isFolder)}</span>
            </ContextMenuItem>
          )}
          {!isTrashed && !isLocalFolder && (
            <ContextMenuItem onSelect={toggleFavorite}>
              <LucideIcons.Star
                className={cn(
                  "h-4 w-4",
                  page.isFavorite && "fill-[var(--goose-color-favorite)] text-[var(--goose-color-favorite)]",
                )}
              />
              <span>{page.isFavorite ? "从最爱移除" : "添加到最爱"}</span>
            </ContextMenuItem>
          )}
          {!isTrashed && !isLocalFolder && (
            <ContextMenuItem onSelect={togglePinned}>
              <LucideIcons.Pin
                className={cn(
                  "h-4 w-4",
                  page.isPinned && "fill-[var(--goose-color-danger)] text-[var(--goose-color-danger)]",
                )}
              />
              <span>{page.isPinned ? "取消置顶" : "置顶页面"}</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="bg-transparent" />

          {/* 只有当页面有父级时才显示"移至顶层"选项 */}
          {hasParent && !isTrashed && (
            <ContextMenuItem onSelect={handleMoveToTopLevel}>
              <LucideIcons.ArrowUpToLine className="h-4 w-4" />
              <span>移至顶层</span>
            </ContextMenuItem>
          )}

          {!isTrashed && !isLocalFolder && movableNotebooks.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2 rounded-[6px] px-1.5 py-1.5 text-[13px]">
                <LucideIcons.FolderOutput className="h-4 w-4" />
                <span>移动到笔记本</span>
              </ContextMenuSubTrigger>
              <ContextMenuPortal>
                <ContextMenuSubContent
                  sideOffset={8}
                  alignOffset={-4}
                  collisionPadding={12}
                  className="w-56 max-h-72 overflow-y-auto !border-0"
                >
                  {movableNotebooks.map((item) => (
                    <ContextMenuItem
                      key={item.id}
                      onSelect={() => handleMoveToNotebook(item.id)}
                    >
                      <span className="truncate">{item.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuPortal>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator className="bg-transparent" />

          {isTrashed ? (
            <>
              <ContextMenuItem onSelect={handleRestore}>
                <LucideIcons.RotateCcw className="h-4 w-4" />
                <span>
                  {isLocalFolder
                    ? page.isFolder
                      ? "恢复文件夹"
                      : "恢复文件"
                    : "恢复页面"}
                </span>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => void permanentlyDeletePageWithCleanup(page.id)}
                className="text-foreground/85 dark:text-foreground/85 focus:text-[var(--goose-color-danger-focus)] focus:bg-destructive/10"
              >
                <LucideIcons.Trash2 className="h-4 w-4" />
                <span>永久删除</span>
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem
              onSelect={() => void deletePageWithUndo(page.id)}
              className="text-foreground/85 dark:text-foreground/85 focus:text-[var(--goose-color-danger-focus)] focus:bg-destructive/10"
            >
              <LucideIcons.Trash2 className="h-4 w-4" />
              <span>移至垃圾箱</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatShortcut("Mod+Backspace")}</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
