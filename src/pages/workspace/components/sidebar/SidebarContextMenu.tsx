import type { Page } from "@/types";
import { extractTitleFromContent } from "@/lib/content-text-extractor";
import { useDeletePageWithUndo } from "@/hooks/useDeletePageWithUndo";

interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
}

export function SidebarContextMenu({
  page,
  children,
}: SidebarContextMenuProps) {
  const { updatePage, duplicatePage, restorePage, permanentlyDeletePage } =
    usePages();
  const { deletePageWithUndo } = useDeletePageWithUndo();
  const isTrashed = !!page.trashedAt;

  const handleRename = () => {
    if (isTrashed) return;
    const currentTitle = extractTitleFromContent(page.content);
    const newTitle = prompt("重命名", currentTitle);
    if (newTitle !== null) {
      // 更新 content 第一行的标题
      const newContent = JSON.parse(JSON.stringify(page.content));
      if (
        newContent.content?.[0]?.type === "heading" &&
        newContent.content[0].attrs?.level === 1
      ) {
        newContent.content[0].content = newTitle
          ? [{ type: "text", text: newTitle }]
          : undefined;
        updatePage(page.id, { content: newContent });
      }
    }
  };

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
    <ContextMenu>
      <ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground/50">
          页面
        </div>
        {!isTrashed && (
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

        <ContextMenuItem onSelect={handleRename} disabled={isTrashed}>
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
              <span>恢复页面</span>
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
  );
}
