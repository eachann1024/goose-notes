import type { Page } from "@/types";
import { useDeletePageWithUndo } from "@/hooks/useDeletePageWithUndo";
import { useNotebooks } from "@/stores/useNotebooks";
import { useContextMenu } from "@/stores/useContextMenu";

interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
  onRequestRename?: (page: Page) => void;
}

export function SidebarContextMenu({
  page,
  children,
  onRequestRename,
}: SidebarContextMenuProps) {
  const { updatePage, duplicatePage, restorePage, permanentlyDeletePage } =
    usePages();
  const { deletePageWithUndo } = useDeletePageWithUndo();
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const isTrashed = !!page.trashedAt;
  const menuLabel = isLocalFolder
    ? page.isFolder
      ? "本地文件夹"
      : "本地文件"
    : "页面";

  const handleDuplicate = () => {
    if (isTrashed) return;
    duplicatePage(page.id);
  };

  const toggleFavorite = () => {
    updatePage(page.id, { isFavorite: !page.isFavorite });
  };

  const handleMoveToTopLevel = () => {
    updatePage(page.id, { parentId: undefined });
  };

  const hasParent = !!page.parentId;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild className="w-full">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground/50">
            {menuLabel}
          </div>
          {!isTrashed && !isLocalFolder && (
            <ContextMenuItem onSelect={toggleFavorite}>
              <LucideIcons.Star
                className={cn(
                  "h-4 w-4",
                  page.isFavorite && "fill-yellow-400 text-yellow-400",
                )}
              />
              <span>{page.isFavorite ? "从最爱移除" : "添加到最爱"}</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={handleDuplicate} disabled={isTrashed}>
            <LucideIcons.Copy className="h-4 w-4" />
            <span>创建副本</span>
            <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
          </ContextMenuItem>

          <ContextMenuItem
            onSelect={(event) => {
              if (isTrashed) return;
              event.preventDefault();
              useContextMenu.getState().close();
              requestAnimationFrame(() => onRequestRename?.(page));
            }}
            disabled={isTrashed}
          >
            <LucideIcons.PenLine className="h-4 w-4" />
            <span>重命名</span>
            <span className="ml-auto text-xs text-muted-foreground">⌘⇧R</span>
          </ContextMenuItem>

          {/* 只有当页面有父级时才显示"移至顶层"选项 */}
          {hasParent && !isTrashed && (
            <ContextMenuItem onSelect={handleMoveToTopLevel}>
              <LucideIcons.ArrowUpToLine className="h-4 w-4" />
              <span>移至顶层</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {isTrashed ? (
            <>
              <ContextMenuItem onSelect={() => restorePage(page.id)}>
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
                onSelect={() => permanentlyDeletePage(page.id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LucideIcons.Trash2 className="h-4 w-4" />
                <span>永久删除</span>
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem
              onSelect={() => deletePageWithUndo(page.id)}
              className="text-muted-foreground focus:text-destructive focus:bg-destructive/10"
            >
              <LucideIcons.Trash2 className="h-4 w-4" />
              <span>移至垃圾箱</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘⌫</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

    </>
  );
}
