import type { Page } from "@/types";
import * as LucideIcons from "lucide-react";
import { SidebarTree } from "./SidebarTree";

interface FavoritesSectionProps {
  width: number;
  rowHeight: number;
  itemHeight: number;
  onCreatePage: () => void;
  onRequestRename: (page: Page) => void;
}

function hasFavoriteAncestor(page: Page, pages: Record<string, Page>) {
  let parentId = page.parentId;
  while (parentId) {
    const parent = pages[parentId];
    if (!parent || parent.trashedAt || parent.workspaceId !== page.workspaceId) {
      return false;
    }
    if (parent.isFavorite) return true;
    parentId = parent.parentId;
  }
  return false;
}

export function FavoritesSection({
  width,
  rowHeight,
  itemHeight,
  onCreatePage,
  onRequestRename,
}: FavoritesSectionProps) {
  const { pages, reorderFavorites } = usePages();
  const { activeNotebookId } = useNotebooks();
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);

  const favorites = useMemo(
    () =>
      Object.values(pages)
        .filter((page) => {
          if (page.trashedAt || !page.isFavorite) return false;
          if (!activeNotebookId) return true;
          return page.workspaceId === activeNotebookId;
        })
        .sort((a, b) => {
          const orderA = a.favoriteOrder ?? a.order ?? a.createdAt;
          const orderB = b.favoriteOrder ?? b.order ?? b.createdAt;
          if (orderA !== orderB) return orderA - orderB;
          return a.id.localeCompare(b.id);
        }),
    [pages, activeNotebookId],
  );

  const favoriteRootIds = useMemo(
    () =>
      favorites
        .filter((page) => !hasFavoriteAncestor(page, pages))
        .map((page) => page.id),
    [favorites, pages],
  );

  const resolveFavoriteSiblings = useCallback(
    (parentId: string | undefined) => {
      if (parentId) return [];
      return favoriteRootIds
        .map((id) => pages[id])
        .filter((page): page is Page => !!page);
    },
    [favoriteRootIds, pages],
  );

  const handleReorderFavorites = useCallback(
    (ids: string[], parentId: string | undefined) => {
      if (parentId) return;
      reorderFavorites(ids);
    },
    [reorderFavorites],
  );

  if (favorites.length === 0 || favoriteRootIds.length === 0) return null;

  return (
    <div className="py-1">
      <div
        className="group flex items-center justify-between pl-2 pr-2 py-1.5 text-xs font-medium text-[hsl(var(--goose-nav-title))] dark:text-[hsl(var(--goose-nav-title))] hover:text-foreground dark:hover:text-foreground/85 cursor-pointer transition-colors"
        onClick={() => setFavoritesCollapsed(!favoritesCollapsed)}
      >
        <span>收藏</span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {favoritesCollapsed ? (
            <LucideIcons.ChevronRight className="h-3 w-3" />
          ) : (
            <LucideIcons.ChevronDown className="h-3 w-3" />
          )}
        </div>
      </div>

      {!favoritesCollapsed && (
        <div className="pl-1 pr-2 pt-0.5 overflow-hidden">
          <SidebarTree
            activeNotebookId={activeNotebookId}
            width={width}
            rowHeight={rowHeight}
            itemHeight={itemHeight}
            viewportHeight={0}
            onCreatePage={onCreatePage}
            onRequestRename={onRequestRename}
            rootPageIds={favoriteRootIds}
            fitContent
            showEmptyState={false}
            allowNest={false}
            resolveSiblings={resolveFavoriteSiblings}
            onReorder={handleReorderFavorites}
            showAddChildButton={false}
          />
        </div>
      )}
    </div>
  );
}
