import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePages } from "@/stores/usePages";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import {
  ChevronRight,
  File,
  SquarePen,
  Settings,
  Search,
  Trash2,
  Plus,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { SettingsDialog } from "./SettingsDialog";
import { NotebookSwitcher } from "./NotebookSwitcher";
import { TrashList } from "./TrashList";
import { Tree } from "react-arborist";
import type { NodeRendererProps, NodeApi } from "react-arborist";
import type { Page } from "@/types";
import { UToolsAdapter } from "@/lib/utools";

// uTools 环境需要侧边栏最小宽度以保证可用性，Web 环境允许更小宽度
const SIDEBAR_MIN_WIDTH = UToolsAdapter.isUTools ? 180 : 120;
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

// 树节点数据结构
interface TreeNode {
  id: string;
  name: string;
  icon?: string;
  children?: TreeNode[];
  page?: Page;
  isPlaceholder?: boolean;
}

// 统一的高度计算逻辑
const useItemHeight = () => {
  const { uiFontSize } = useSettings();

  return useMemo(() => {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    // 基础高度
    return Math.round(rootFontSize * 2);
  }, [uiFontSize]);
};

// 将扁平的 pages 转换为树形结构
function buildTree(
  pages: Record<string, Page>,
  openPageIds: Set<string>,
  parentId?: string,
  workspaceId?: string,
): TreeNode[] {
  const children = Object.values(pages)
    .filter((p) => {
      const matchParent = p.parentId === parentId && !p.trashedAt;
      const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true;
      return matchParent && matchWorkspace;
    })
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));

  const nodes: TreeNode[] = children.map((page) => ({
    id: page.id,
    name: page.title || "无标题",
    icon: page.icon,
    children: buildTree(pages, openPageIds, page.id, workspaceId),
    page,
  }));

  // 如果节点展开且没有子页面，添加 "内无页面" 占位符
  if (parentId && openPageIds.has(parentId) && nodes.length === 0) {
    return [
      {
        id: `${parentId}-empty`,
        name: "内无页面",
        isPlaceholder: true,
      },
    ];
  }

  return nodes;
}

// 自定义节点渲染
type PageNodeProps = NodeRendererProps<TreeNode> & {
  itemHeight: number;
};

function PageNode({ node, style, dragHandle, itemHeight }: PageNodeProps) {
  const { activePageId, setActivePage, createPage, pages } = usePages();
  const { activeNotebookId } = useNotebooks();
  const isActive = activePageId === node.id;
  const isPlaceholder = node.data.isPlaceholder;
  const iconName = node.data.icon;

  const { paddingLeft: _ignored, height: _ignoredHeight, ...itemStyle } = style;

  const indent = node.level * 16;
  const paddingLeft = indent;

  if (isPlaceholder) {
    return (
      <div
        style={{ ...itemStyle, height: itemHeight }}
        className="flex items-center px-2 mx-1 select-none"
      >
        <div
          style={{ paddingLeft: paddingLeft + 18 }}
          className="text-[13px] text-muted-foreground/45 italic truncate"
        >
          {node.data.name}
        </div>
      </div>
    );
  }

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();

    const existingBlankChild = Object.values(pages).find((p) => {
      const isChild = p.parentId === node.id && !p.trashedAt;
      const isBlankTitle = !p.title || p.title.trim() === "";
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
      if (!node.isOpen) node.open();
      setActivePage(existingBlankChild.id);
    } else {
      if (!node.isOpen) node.open();
      createPage(node.id, activeNotebookId || DEFAULT_NOTEBOOK);
    }
  };

  return (
    <SidebarContextMenu page={node.data.page!}>
      <div
        ref={dragHandle}
        style={{ ...itemStyle, height: itemHeight }}
        className={cn(
          "group relative flex items-center px-2 mx-1 rounded-md cursor-pointer transition-colors text-sm font-medium",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          node.state.isDragging && "opacity-50",
        )}
        onClick={(e) => {
          e.stopPropagation();
          setActivePage(node.id);
        }}
      >
        <div
          className="flex items-center h-full gap-2 min-w-0 flex-1"
          style={{ paddingLeft }}
        >
          {/* 图标与展开/折叠按钮区域 - 16px 宽以确保对齐 */}
          <div
            className="group/icon relative flex items-center justify-center w-5 h-5 shrink-0 -ml-0.5 rounded hover:bg-muted-foreground/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              node.toggle();
            }}
          >
            <div className="relative flex items-center justify-center w-full h-full z-10">
              <div
                className={cn(
                  "flex items-center justify-center",
                  !node.isOpen && "group-hover/icon:hidden",
                )}
              >
                {node.isOpen ? (
                  <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground/70" />
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
                      <File className="h-4 w-4 text-muted-foreground/70" />
                    )}
                  </>
                )}
              </div>

              {!node.isOpen && (
                <div className="hidden group-hover/icon:flex items-center justify-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                </div>
              )}
            </div>
          </div>

          {/* 标题 */}
          <span className="truncate text-sm flex-1">{node.data.name}</span>
        </div>

        {/* 右侧操作按钮 - 绝对定位不占空间 */}
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
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </SidebarContextMenu>
  );
}

// 收藏页面节点 - 支持展开子页面
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

  // 获取子页面
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
      const isBlankTitle = !p.title || p.title.trim() === "";
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
                    <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground/70" />
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
                        <File className="h-4 w-4 text-muted-foreground/70" />
                      )}
                    </>
                  )}
                </div>

                {!isExpanded && (
                  <div className="hidden group-hover/icon:flex items-center justify-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                )}
              </div>
            </div>

            <span className="truncate text-sm flex-1">
              {page.title || "无标题"}
            </span>
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
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </SidebarContextMenu>

      {/* 子页面 */}
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

type SidebarView = "pages" | "trash";

export function Sidebar({ className }: SidebarProps) {
  const {
    createPage,
    updatePage,
    deletePage,
    pages,
    activePageId,
    setActivePage,
    reorderPages,
    getChildren,
    getFavorites,
  } = usePages();
  const { activeNotebookId } = useNotebooks();
  const { uiFontSize: _ignored } = useSettings();

  const itemHeight = useItemHeight();
  const rowHeight = itemHeight + 1;

  // uTools 环境默认最窄(180)，Web 环境默认稍宽(220)
  const DEFAULT_SIDEBAR_WIDTH = UToolsAdapter.isUTools ? 180 : 220;
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("sidebar-width");
    return saved
      ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(480, Number(saved)))
      : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<any>(null);
  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());

  // 处理节点切换展开状态
  const handleToggle = (id: string) => {
    setOpenPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Cmd/Ctrl + Backspace 删除选中页面
  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      // 检查是否按下 Cmd/Ctrl + Backspace
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        // 确保有选中的页面且不在编辑器输入状态
        const target = e.target as HTMLElement;
        const isInEditor =
          target.closest(".ProseMirror") ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA";

        if (activePageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          setDeleteDialogOpen(true);
        }
      }
    },
    [activePageId, currentView],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleDeleteShortcut);
    return () => {
      document.removeEventListener("keydown", handleDeleteShortcut);
    };
  }, [handleDeleteShortcut]);

  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [expandedFavorites, setExpandedFavorites] = useState<Set<string>>(
    new Set(),
  );

  // 宽度变化时保存到 localStorage（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("sidebar-width", String(width));
    }, 300);
    return () => clearTimeout(timer);
  }, [width]);

  const handleConfirmDelete = () => {
    if (activePageId) {
      deletePage(activePageId);
      setDeleteDialogOpen(false);
    }
  };

  // 将 pages 转换为 tree data（基于当前记事本过滤）
  const treeData = useMemo(
    () =>
      buildTree(pages, openPageIds, undefined, activeNotebookId || undefined),
    [pages, openPageIds, activeNotebookId],
  );

  // 获取收藏页面
  const favorites = useMemo(
    () => getFavorites(activeNotebookId || undefined),
    [getFavorites, activeNotebookId, pages],
  );

  // 检查页面内容是否为空（只包含一个空段落）
  const isEmptyContent = (content: any) => {
    if (!content || content.type !== "doc") return true;
    if (!content.content || content.content.length === 0) return true;
    if (content.content.length === 1) {
      const first = content.content[0];
      // 只有一个空段落算空内容
      if (
        first.type === "paragraph" &&
        (!first.content || first.content.length === 0)
      ) {
        return true;
      }
    }
    return false;
  };

  const handleCreatePage = () => {
    // 查找当前记事本中是否存在空白页面
    const existingBlankPage = Object.values(pages).find((p) => {
      const matchWorkspace = p.workspaceId === (activeNotebookId || "default");
      const notTrashed = !p.trashedAt;
      const isBlankTitle = !p.title || p.title.trim() === "";
      const isBlankContent = isEmptyContent(p.content);
      return matchWorkspace && notTrashed && isBlankTitle && isBlankContent;
    });

    if (existingBlankPage) {
      // 存在空白页面，直接选中
      setActivePage(existingBlankPage.id);
    } else {
      createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);
    }
  };

  const handleMove = ({
    dragIds,
    parentId,
    index,
  }: {
    dragIds: string[];
    parentId: string | null;
    index: number;
  }) => {
    const targetParentId = parentId || undefined;
    const siblings = getChildren(targetParentId, activeNotebookId || undefined);
    const filteredSiblings = siblings.filter((p) => !dragIds.includes(p.id));
    const movedPages = dragIds.map((id) => pages[id]).filter(Boolean) as Page[];
    const newSiblings = [...filteredSiblings];
    newSiblings.splice(index, 0, ...movedPages);
    const newOrderIds = newSiblings.map((p) => p.id);
    reorderPages(newOrderIds, targetParentId);
  };

  const handleRename = ({ id, name }: { id: string; name: string }) => {
    updatePage(id, { title: name });
  };

  const handleActivate = (node: NodeApi<TreeNode>) => {
    setActivePage(node.id);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + e.clientX - startX;
      setWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(480, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  // 垃圾箱视图
  if (currentView === "trash") {
    return (
      <div
        ref={sidebarRef}
        className={cn(
          "pb-0 border-r bg-muted/30 h-screen flex flex-col relative",
          className,
        )}
        style={{ width }}
      >
        <div
          className={cn(
            "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
            isResizing && "bg-primary",
          )}
          onMouseDown={startResizing}
        />
        <TrashList onBack={() => setCurrentView("pages")} />
      </div>
    );
  }

  // 公共 Header 渲染组件
  const SectionHeader = ({
    title,
    collapsed,
    onToggle,
  }: {
    title: string;
    collapsed: boolean;
    onToggle: () => void;
  }) => (
    <div
      className="group flex items-center justify-between px-4 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <span>{title}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <LucideIcons.ChevronDown className="h-3 w-3" />
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "pb-0 bg-muted/30 h-screen flex flex-col relative group/sidebar",
        className,
      )}
      style={{
        width: width,
        borderRightWidth: "1px",
        borderRightColor: "hsl(var(--border))",
      }}
    >
      {/* Resizer Handle */}
      <div
        className={cn(
          "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
          isResizing && "bg-primary",
        )}
        onMouseDown={startResizing}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Area - 记事本切换器 */}
        <div className="px-3 h-12 flex items-center shrink-0">
          <div className="flex items-center gap-1 w-full">
            <div className="flex-1 min-w-0">
              <NotebookSwitcher />
            </div>
            <Button
              onClick={handleCreatePage}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              title="新建页面"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 搜索入口 */}
        <div className="px-3 pb-2 pt-0">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-muted-foreground h-8 px-2 bg-muted/40 border-transparent shadow-none",
              "hover:bg-muted/60 hover:text-foreground transition-colors",
            )}
            onClick={() => {
              // 触发全局搜索 Cmd+K
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="mr-2 h-4 w-4 opacity-50" />
            <span className="text-sm">搜索</span>
            <span className="ml-auto text-xs text-muted-foreground/50">⌘K</span>
          </Button>
        </div>

        {/* 收藏区 */}
        {favorites.length > 0 && (
          <div className="py-1">
            <SectionHeader
              title="收藏"
              collapsed={favoritesCollapsed}
              onToggle={() => setFavoritesCollapsed(!favoritesCollapsed)}
            />
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
        )}

        {/* Page List with react-arborist */}
        <ScrollArea className="flex-1">
          <div className="mt-1">
            <SectionHeader
              title="页面"
              collapsed={pagesCollapsed}
              onToggle={() => setPagesCollapsed(!pagesCollapsed)}
            />
          </div>
          {!pagesCollapsed && (
            <div className="px-2 pb-20">
              {treeData.length > 0 ? (
                <Tree
                  ref={treeRef}
                  data={treeData}
                  onMove={handleMove}
                  onRename={handleRename}
                  onActivate={handleActivate}
                  selection={activePageId || undefined}
                  openByDefault={false}
                  width={width - 16}
                  height={600}
                  indent={16}
                  rowHeight={rowHeight}
                  overscanCount={5}
                  disableEdit={false}
                  disableDrag={false}
                  disableDrop={false}
                  onToggle={handleToggle}
                >
                  {(props) => <PageNode {...props} itemHeight={itemHeight} />}
                </Tree>
              ) : (
                <div className="text-sm text-muted-foreground px-4 py-8 text-center bg-muted/30 rounded mx-2 border border-dashed">
                  <div className="mb-2">👻</div>
                  <p>暂无页面</p>
                  <Button
                    variant="link"
                    onClick={handleCreatePage}
                    className="h-auto p-0 mt-1"
                  >
                    创建第一个页面
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 mt-auto border-t bg-background/50 backdrop-blur-sm space-y-1">
          {/* 垃圾箱 */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setCurrentView("trash")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span className="text-sm">垃圾箱</span>
          </Button>
          {/* 设置 */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span className="text-sm">设置</span>
          </Button>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要将「
              {activePageId ? pages[activePageId]?.title || "无标题" : ""}
              」移至垃圾箱吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
