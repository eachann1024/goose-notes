import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import { Copy, Trash2, PenLine, Star, ArrowUpToLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
}

export function SidebarContextMenu({
  page,
  children,
}: SidebarContextMenuProps) {
  const { deletePage, updatePage, duplicatePage } = usePages();

  const handleRename = () => {
    // Prompt for rename or trigger inline edit (simplified to prompt for now)
    const newTitle = prompt("重命名", page.title);
    if (newTitle !== null) {
      updatePage(page.id, { title: newTitle || "无标题" });
    }
  };

  const handleDuplicate = () => {
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
        <ContextMenuItem onSelect={toggleFavorite}>
          <Star
            className={cn(
              "h-4 w-4",
              page.isFavorite && "fill-yellow-400 text-yellow-400",
            )}
          />
          <span>{page.isFavorite ? "从最爱移除" : "添加到最爱"}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={handleDuplicate}>
          <Copy className="h-4 w-4" />
          <span>创建副本</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
        </ContextMenuItem>

        <ContextMenuItem onSelect={handleRename}>
          <PenLine className="h-4 w-4" />
          <span>重命名</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘⇧R</span>
        </ContextMenuItem>

        {/* 只有当页面有父级时才显示"移至顶层"选项 */}
        {hasParent && (
          <ContextMenuItem onSelect={handleMoveToTopLevel}>
            <ArrowUpToLine className="h-4 w-4" />
            <span>移至顶层</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={() => deletePage(page.id)}
          className="text-muted-foreground focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          <span>移至垃圾箱</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
