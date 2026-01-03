import type { Page } from "@/types";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { extractTitleFromContent } from "@/lib/content-text-extractor";

interface FavoritesSectionProps {
  itemHeight: number;
}

interface FavoriteNodeProps {
  page: Page;
  level: number;
  pages: Record<string, Page>;
  activePageId: string | null;
  setActivePage: (id: string) => void;
  expandedFavorites: Set<string>;
  setExpandedFavorites: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeNotebookId: string | null;
  createPage: (parentId?: string, workspaceId?: string) => void;
  itemHeight: number;
}

function FavoriteNode({
  page,
  level,
  pages,
  activePageId,
  setActivePage,
  expandedFavorites,
  setExpandedFavorites,
  activeNotebookId,
  createPage,
  itemHeight,
}: FavoriteNodeProps) {
  const iconName = page.icon;
  const isExpanded = expandedFavorites.has(page.id);
  const isActive = activePageId === page.id;

  const children = Object.values(pages)
    .filter((p) => p.parentId === page.id && !p.trashedAt)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));

  const hasChildren = children.length > 0;
  const indent = level * 16;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(page.id)) {
        next.delete(page.id);
      } else {
        next.add(page.id);
      }
      return next;
    });
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();

    const existingBlankChild = Object.values(pages).find((p) => {
      const isChild = p.parentId === page.id && !p.trashedAt;
      const title = extractTitleFromContent(p.content);
      const isBlankTitle = !title || title.trim() === "" || title === "无标题";
      const isBlankContent =
        !p.content ||
        p.content.type !== "doc" ||
        !p.content.content ||
        p.content.content.length === 0 ||
        (p.content.content.length === 1 &&
          p.content.content[0].type === "paragraph" &&
          (!p.content.content[0].content ||
            p.content.content[0].content.length === 0));
      return isChild && isBlankTitle && isBlankContent;
    });

    if (existingBlankChild) {
      if (!isExpanded) {
        setExpandedFavorites((prev) => new Set(prev).add(page.id));
      }
      setActivePage(existingBlankChild.id);
    } else {
      if (!isExpanded) {
        setExpandedFavorites((prev) => new Set(prev).add(page.id));
      }
      createPage(page.id, activeNotebookId || DEFAULT_NOTEBOOK);
    }
  };

  return (
    <>
      <SidebarContextMenu page={page}>
        <div
          style={{ height: itemHeight }}
          className={cn(
            "group relative flex items-center px-2 mx-1 rounded-md cursor-pointer transition-colors text-sm font-medium",
            isActive
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          onClick={() => setActivePage(page.id)}
        >
          <div
            className="flex items-center h-full gap-2 min-w-0 flex-1"
            style={{ paddingLeft: indent }}
          >
            <div
              className="group/icon relative flex items-center justify-center w-5 h-5 shrink-0 -ml-0.5 rounded hover:bg-muted-foreground/10 transition-colors"
              onClick={toggleExpand}
            >
              <div className="relative flex items-center justify-center w-full h-full z-10">
                <div
                  className={cn(
                    "flex items-center justify-center",
                    !isExpanded && "group-hover/icon:hidden",
                  )}
                >
                  {isExpanded ? (
                    <LucideIcons.ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground/70" />
                  ) : (
                    <>
                      {iconName ? (
                        <div className="h-4 w-4 flex items-center justify-center">
                          {(LucideIcons as any)[iconName] ? (
                            (() => {
                              const Icon = (LucideIcons as any)[iconName];
                              return <Icon className="h-4 w-4" />;
                            })()
                          ) : (
                            <span className="text-sm">{iconName}</span>
                          )}
                        </div>
                      ) : (
                        <LucideIcons.File className="h-4 w-4 text-muted-foreground/70" />
                      )}
                    </>
                  )}
                </div>

                {!isExpanded && (
                  <div className="hidden group-hover/icon:flex items-center justify-center">
                    <LucideIcons.ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                )}
              </div>
            </div>

            <span
              className={cn(
                "truncate text-sm flex-1",
                page.trashedAt && "opacity-50 italic",
              )}
            >
              {extractTitleFromContent(page.content)}
            </span>
            {page.trashedAt && (
              <LucideIcons.Trash2 className="h-3 w-3 text-muted-foreground/50 ml-1" />
            )}
          </div>

          <div
            className={cn(
              "absolute right-0 top-0 h-full flex items-center gap-0.5 pr-1 pl-4 opacity-0 group-hover:opacity-100 transition-opacity",
              "bg-gradient-to-r from-transparent",
              isActive ? "to-muted" : "to-[hsl(var(--muted)/0.6)]",
            )}
          >
            <button
              className="p-1 rounded hover:bg-muted-foreground/20 active:bg-muted-foreground/30 text-muted-foreground/70 hover:text-foreground transition-colors"
              onClick={handleAddChild}
            >
              <LucideIcons.Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </SidebarContextMenu>

      {isExpanded &&
        (hasChildren ? (
          children.map((child) => (
            <FavoriteNode
              key={child.id}
              page={child}
              level={level + 1}
              pages={pages}
              activePageId={activePageId}
              setActivePage={setActivePage}
              expandedFavorites={expandedFavorites}
              setExpandedFavorites={setExpandedFavorites}
              activeNotebookId={activeNotebookId}
              createPage={createPage}
              itemHeight={itemHeight}
            />
          ))
        ) : (
          <div
            style={{ height: itemHeight, paddingLeft: indent + 18 }}
            className="flex items-center px-2 mx-1 select-none"
          >
            <span className="text-[13px] text-muted-foreground/45 italic truncate">
              内无页面
            </span>
          </div>
        ))}
    </>
  );
}

export function FavoritesSection({ itemHeight }: FavoritesSectionProps) {
  const { pages, activePageId, setActivePage, createPage, getFavorites } =
    usePages();
  const { activeNotebookId } = useNotebooks();
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [expandedFavorites, setExpandedFavorites] = useState<Set<string>>(
    new Set(),
  );

  const favorites = useMemo(
    () => getFavorites(activeNotebookId || undefined),
    [getFavorites, activeNotebookId, pages],
  );

  if (favorites.length === 0) return null;

  return (
    <div className="py-1">
      <div
        className="group flex items-center justify-between px-4 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
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
        <div className="px-2 pt-0.5 overflow-hidden flex flex-col gap-px">
          {favorites.map((page) => (
            <FavoriteNode
              key={page.id}
              page={page}
              level={0}
              pages={pages}
              activePageId={activePageId}
              setActivePage={setActivePage}
              expandedFavorites={expandedFavorites}
              setExpandedFavorites={setExpandedFavorites}
              activeNotebookId={activeNotebookId}
              createPage={createPage}
              itemHeight={itemHeight}
            />
          ))}
        </div>
      )}
    </div>
  );
}
