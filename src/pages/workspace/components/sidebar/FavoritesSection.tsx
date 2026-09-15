import type { Page } from "@/types";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  usePresenceData,
  useReducedMotion,
} from "motion/react";
import * as LucideIcons from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { areSidebarPagesEqual } from "@/stores/pages/areSidebarPagesEqual";
import { SidebarTree } from "./SidebarTree";

interface FavoritesSectionProps {
  width: number;
  rowHeight: number;
  itemHeight: number;
  onCreatePage: () => void;
}

function FavoritePagesMotion({
  children,
  id,
  shouldReduceMotion,
}: {
  children: React.ReactNode;
  id: string;
  shouldReduceMotion: boolean | null;
}) {
  const isPresent = useIsPresent();
  const instant = usePresenceData() === true;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={
        instant
          ? { duration: 0 }
          : shouldReduceMotion
            ? { height: { duration: 0 }, opacity: { duration: 0.15 } }
            : {
                duration: isPresent ? 0.2 : 0.15,
                ease: isPresent ? "easeOut" : "easeIn",
              }
      }
      className="overflow-hidden pl-0"
      id={id}
      aria-hidden={!isPresent}
      inert={!isPresent || undefined}
    >
      <div className="pt-0.5">{children}</div>
    </motion.div>
  );
}

export function FavoritesSection({
  width,
  rowHeight,
  itemHeight,
  onCreatePage,
}: FavoritesSectionProps) {
  const pages = useStoreWithEqualityFn(
    usePages,
    (state) => state.pages,
    areSidebarPagesEqual,
  );
  const reorderFavorites = usePages((state) => state.reorderFavorites);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const favoritesCollapsed = useSidebarView((s) => s.favoritesCollapsed);
  const setFavoritesCollapsed = useSidebarView((s) => s.setFavoritesCollapsed);
  const shouldReduceMotion = useReducedMotion();
  const keyboardActivation = useRef(true);

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
    () => favorites.map((page) => page.id),
    [favorites],
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

  if (favorites.length === 0 || favoriteRootIds.length === 0) {
    return null;
  }

  return (
    <div className="py-1">
      <button
        type="button"
        className="sidebar-section-label sidebar-favorites-label group flex h-8 w-full cursor-pointer items-center justify-between rounded-lg pl-0.5 pr-2 text-xs font-medium text-[hsl(var(--goose-nav-title))] transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current"
        onClick={(event) => {
          keyboardActivation.current = event.detail === 0;
          setFavoritesCollapsed(!favoritesCollapsed);
        }}
        aria-expanded={!favoritesCollapsed}
        aria-controls="sidebar-favorites-pages"
      >
        <span className="inline-flex h-6 min-w-[42px] items-center justify-center px-2">
          收藏
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          {favoritesCollapsed ? (
            <LucideIcons.ChevronRight className="h-3 w-3" />
          ) : (
            <LucideIcons.ChevronDown className="h-3 w-3" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false} custom={keyboardActivation.current}>
        {!favoritesCollapsed && (
          <FavoritePagesMotion
            key="favorite-pages"
            id="sidebar-favorites-pages"
            shouldReduceMotion={shouldReduceMotion}
          >
            <SidebarTree
              activeNotebookId={activeNotebookId}
              width={width}
              rowHeight={rowHeight}
              itemHeight={itemHeight}
              viewportHeight={0}
              onCreatePage={onCreatePage}
              rootPageIds={favoriteRootIds}
              flatRoots
              fitContent
              showEmptyState={false}
              allowNest={false}
              resolveSiblings={resolveFavoriteSiblings}
              onReorder={handleReorderFavorites}
              showAddChildButton={false}
              draggablePageIds={favoriteRootIds}
            />
          </FavoritePagesMotion>
        )}
      </AnimatePresence>
    </div>
  );
}
