import { Tree } from "react-arborist";
import type {
  CursorProps,
  NodeApi,
  NodeRendererProps,
  TreeApi,
} from "react-arborist";
import type { Page } from "@/types";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { IconSelector } from "../shared/IconSelector";

interface SidebarTreeProps {
  activeNotebookId: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
  onRequestRename: (page: Page) => void;
}

const DEFAULT_NOTEBOOK = "default-notebook";

interface TreeNode {
  id: string;
  name: string;
  icon?: string;
  children?: TreeNode[];
  page?: Page;
  isPlaceholder?: boolean;
}

const buildTree = (
  pages: Record<string, Page>,
  openPageIds: Set<string>,
  parentId: string | undefined, // Changed to allow specific parent query or undefined for root
  workspaceId: string | undefined,
  isLocalNotebook: boolean = false,
): TreeNode[] => {
  // 1. Group pages by parentId (Pre-computation step - O(N))
  // We compute this ONCE for the entire tree is not possible inside a recursive function efficiently 
  // without passing the map around.
  // So we will perform the grouping inside the component's useMemo and this function will be deprecated 
  // or we rewrite this to simple helper that expects grouped data.
  
  // However, to keep the diff small and clean, let's implement the `useMemo` logic in the component
  // and remove this standalone `buildTree` if possible, or make this `buildTree` the "optimized builder".
  
  // Strategy: We will replace this implementation with a wrapper that computes the map, 
  // then calls separate recursive function.
  
  const groupMap = new Map<string, Page[]>();
  const rootPages: Page[] = [];

  Object.values(pages).forEach((p) => {
    if (p.trashedAt) return;
    if (workspaceId && p.workspaceId !== workspaceId) return;

    if (!p.parentId) {
      rootPages.push(p);
    } else {
      if (!groupMap.has(p.parentId)) {
        groupMap.set(p.parentId, []);
      }
      groupMap.get(p.parentId)!.push(p);
    }
  });

  const sortPages = (items: Page[]) => {
    return items.sort((a, b) => {
      if (isLocalNotebook) {
        if (a.isFolder !== b.isFolder) {
          return a.isFolder ? -1 : 1;
        }
        const nameA = getPageTitle(a);
        const nameB = getPageTitle(b);
        return nameA.localeCompare(nameB, "zh-CN", { numeric: true });
      }

      const orderA = a.order ?? a.createdAt;
      const orderB = b.order ?? b.createdAt;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
  };

    const recursiveBuild = (currentPages: Page[]): TreeNode[] => {
    const sorted = sortPages(currentPages);
    return sorted.map((p) => {
      const childrenPages = groupMap.get(p.id) || [];
      const childrenNodes = recursiveBuild(childrenPages);

      const node: TreeNode = {
        id: p.id,
        name: getPageTitle(p),
        icon: p.icon,
        page: p,
      };

      // Only attach children if it's NOT a local notebook OR if it IS a folder
      // This ensures local files are treated as leaves by the tree component
      if (!isLocalNotebook || p.isFolder) {
          if (openPageIds.has(p.id) && childrenNodes.length === 0) {
              node.children = [
                  {
                      id: `${p.id}-empty`,
                      name: isLocalNotebook ? "内无文件" : "内无页面",
                      isPlaceholder: true,
                  },
              ];
          } else {
              node.children = childrenNodes;
          }
      }

      return node;
    });
  };

  // If parentId is specified (not likely used in main tree build anymore but good for compatibility),
  // we would start from there. But the main usage is building the whole tree.
  // If parentId is provided, we just return the children of that parent.
  if (parentId) {
    const children = groupMap.get(parentId) || [];
    return recursiveBuild(children);
  }

  return recursiveBuild(rootPages);
};

type PageNodeProps = NodeRendererProps<TreeNode> & {
  itemHeight: number;
  activeNotebookId: string | null;
  onRequestRename: (page: Page) => void;
};


function PageNode({
  node,
  style,
  dragHandle,
  itemHeight,
  activeNotebookId: _activeNotebookId,
  onRequestRename,
}: PageNodeProps) {
  const activePageId = usePages((state) => state.activePageId);
  const setActivePage = usePages((state) => state.setActivePage);
  const createPage = usePages((state) => state.createPage);
  const createLocalPage = usePages((state) => state.createLocalPage);
  const updatePage = usePages((state) => state.updatePage);
  
  // Note: We access pages[id] via node.data.page usually, but for child creation we need the store
  // To avoid subscribing to the WHOLE pages object, we should use a callback or selector if possible.
  // However, handleAddChild needs to scan pages. We can use `usePages.getState()` in event handler
  // to avoid rendering dependency!
  
  const notebookId = node.data.page?.workspaceId;
  const notebook = notebookId
    ? useNotebooks.getState().notebooks[notebookId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const isActive = activePageId === node.id;
  const isPlaceholder = node.data.isPlaceholder;
  const isDropTarget = node.willReceiveDrop && !isPlaceholder && !node.state.isDragging;
  const iconName = node.data.icon;
  const showFolderIcon = isLocalFolder && node.data.page?.isFolder;
  
  // Logic for showing arrow: ONLY if it has children
  const hasChildren = node.data.children && node.data.children.length > 0;
  // If we want to strictly follow "Show arrow if it has children", we use hasChildren.
  // Note: Some trees show arrow for all folders. Feishu usually hides arrow if leaf.
  const showArrow = hasChildren && !isPlaceholder;

  // We are removing the childCount indicator as requested.

  const { paddingLeft: _ignored, height: _ignoredHeight, ...itemStyle } = style;

  // Visual indentation (decoupled from logical drop zone)
  const indent = node.level * 24;
  const paddingLeft = indent;
  const rowStyle = { ...itemStyle, height: itemHeight };

  if (isPlaceholder) {
    return (
      <div style={rowStyle} className="relative px-1 select-none">
        <div className="flex items-center h-full px-2 rounded-md">
          <div
            style={{ paddingLeft: paddingLeft + 24 }} // Adjust padding to align with text
            className="text-[13px] text-muted-foreground/45 dark:text-muted-foreground/35 italic truncate"
          >
            {node.data.name}
          </div>
        </div>
      </div>
    );
  }

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isLocalFolder) {
      createLocalPage(node.id, notebookId || undefined);
      if (!node.isOpen) node.open();
      return;
    }

    const currentPages = usePages.getState().pages;
    const existingBlankChild = Object.values(currentPages).find((p) => {
      const isChild = p.parentId === node.id && !p.trashedAt;
      const title = getPageTitle(p);
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
      if (!node.isOpen) node.open();
      setActivePage(existingBlankChild.id);
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
    } else {
      if (!node.isOpen) node.open();
      createPage(node.id, notebookId || DEFAULT_NOTEBOOK);
    }
  };

  return (
    <SidebarContextMenu
      page={node.data.page!}
      onRequestRename={onRequestRename}
    >
      <div
        ref={dragHandle}
        style={rowStyle}
        className="group relative px-2"
      >
        <div
          className={cn(
            "relative flex items-center h-full pl-2 pr-1 rounded-md cursor-pointer transition-colors text-sm font-medium",
            isDropTarget && "sidebar-drop-target",
            node.state.isDragging && "opacity-50",
            // Unify hover effect: Use a clearer background color
            !isActive && "hover:bg-muted/60 dark:hover:bg-muted/40 text-muted-foreground dark:text-muted-foreground/65 hover:text-foreground dark:hover:text-foreground/85 transition-colors duration-200",
            isActive && "bg-muted/60 dark:bg-muted/40 text-foreground dark:text-foreground/85"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isLocalFolder && node.data.page?.isFolder) {
              node.toggle();
              return;
            }
            // Single click selects the page
            if (activePageId !== node.id) {
              setActivePage(node.id);
            }
          }}
        >
           {/* Indentation Wrapper */}
          <div 
             className="flex items-center h-full flex-1 min-w-0"
             style={{ paddingLeft }}
          >
            {/* Arrow Area - Fixed width */}
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 shrink-0 -ml-1 mr-0.5 rounded transition-all duration-300 ease-out",
                showArrow
                  ? "hover:bg-muted-foreground/10 cursor-pointer"
                  : "opacity-0 pointer-events-none"
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (showArrow) node.toggle();
              }}
            >
              <LucideIcons.ChevronRight 
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200", 
                  node.isOpen && "rotate-90"
                )} 
              />
            </div>

            {/* Icon Area - Fixed width */}
            <div 
              className="flex items-center justify-center w-5 h-5 shrink-0 mr-1.5 select-none"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {isLocalFolder ? (
                <div className="flex items-center justify-center w-5 h-5">
                  {showFolderIcon ? (
                    <LucideIcons.Folder className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                  ) : (
                    <LucideIcons.FileText className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                  )}
                </div>
              ) : (
                <IconSelector
                  value={iconName}
                  onChange={(newIcon) =>
                    updatePage(node.id, { icon: newIcon as string })
                  }
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded hover:bg-muted-foreground/15 transition-colors cursor-pointer",
                    )}
                  >
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
                    ) : showFolderIcon ? (
                      <LucideIcons.Folder className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                    ) : (
                      <LucideIcons.FileText className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                    )}
                  </div>
                </IconSelector>
              )}
            </div>

            {/* Title */}
            <span className="truncate text-sm flex-1 min-w-0 select-none">
              {node.data.name}
            </span>
          </div>

          {/* Actions (Plus Button) */}
          <div className="ml-auto hidden group-hover:flex items-center pl-1 shrink-0">
             <button
                className="p-1 rounded hover:bg-muted-foreground/15 text-muted-foreground/70 hover:text-foreground transition-colors"
                onClick={handleAddChild}
              >
                <LucideIcons.Plus className="h-3.5 w-3.5" />
              </button>
          </div>
        </div>
      </div>
    </SidebarContextMenu>
  );
}


export function SidebarTree({
  activeNotebookId,
  width,
  rowHeight,
  itemHeight,
  viewportHeight,
  onCreatePage,
  onRequestRename,
}: SidebarTreeProps) {
  const {
    pages,
    activePageId,
    setActivePage,
    updatePage,
    reorderPages,
    getChildren,
    expandPageId,
    setExpandPageId,
  } = usePages();
  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());
  const treeRef = useRef<TreeApi<TreeNode> | null>(null);
  const expandAttemptsRef = useRef(0);

  useEffect(() => {
    if (!expandPageId) return;

    expandAttemptsRef.current = 0;

    const pageIdToExpand = expandPageId;
    const maxAttempts = 20; // 增加重试次数，等待页面加载

    const tryOpen = () => {
      expandAttemptsRef.current += 1;

      // 检查页面是否已加载到 store
      const page = pages[pageIdToExpand];
      if (!page) {
        // 页面还没加载，继续等待
        if (expandAttemptsRef.current < maxAttempts) {
          setTimeout(tryOpen, 100);
        } else {
          // 超时放弃
          setExpandPageId(null);
        }
        return;
      }

      if (page.trashedAt) {
        setExpandPageId(null);
        return;
      }

      if (activeNotebookId && page.workspaceId !== activeNotebookId) {
        // 笔记本不匹配，等待切换
        if (expandAttemptsRef.current < maxAttempts) {
          setTimeout(tryOpen, 100);
        }
        return;
      }

      // 检查 tree 是否已渲染
      if (!treeRef.current) {
        if (expandAttemptsRef.current < maxAttempts) {
          setTimeout(tryOpen, 100);
        }
        return;
      }

      // 收集祖先链（从当前页面向上）
      const ancestorIds: string[] = [];
      let current = page;
      while (current.parentId && pages[current.parentId]) {
        ancestorIds.push(current.parentId);
        current = pages[current.parentId];
      }

      // 展开所有祖先节点（从根到叶）
      ancestorIds.reverse().forEach((id) => treeRef.current!.open(id));

      // 滚动到目标节点（延迟等待展开动画）
      setTimeout(() => {
        treeRef.current?.scrollTo(pageIdToExpand);
      }, 100);

      setExpandPageId(null);
    };

    // 延迟启动，等待 React 状态更新完成
    setTimeout(tryOpen, 50);
  }, [
    expandPageId,
    pages,
    activeNotebookId,
    setExpandPageId,
  ]);

  const treeData = useMemo(() => {
    const notebook = activeNotebookId
      ? useNotebooks.getState().notebooks[activeNotebookId]
      : undefined;
    const isLocalNotebook = notebook?.source === "local-folder";
    // We pass undefined for parentId to build from root
    return buildTree(
      pages,
      openPageIds,
      undefined,
      activeNotebookId || undefined,
      isLocalNotebook,
    );
  }, [pages, openPageIds, activeNotebookId]);

  const handleMove = useCallback(
    ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      const targetParentId = parentId || undefined;
      const siblings = getChildren(
        targetParentId,
        activeNotebookId || undefined,
      );
      const filteredSiblings = siblings.filter((p) => !dragIds.includes(p.id));
      const movedPages = dragIds
        .map((id) => pages[id])
        .filter(Boolean) as Page[];
      const newSiblings = [...filteredSiblings];
      // Bound index to ensure it's valid
      const safeIndex = Math.max(0, Math.min(index, newSiblings.length));
      newSiblings.splice(safeIndex, 0, ...movedPages);
      const newOrderIds = newSiblings.map((p) => p.id);
      reorderPages(newOrderIds, targetParentId);

      // 检查之前的父节点，如果变空了，则自动收起
      const oldParentIds = new Set<string>();
      dragIds.forEach((id) => {
        const p = pages[id];
        if (p?.parentId) oldParentIds.add(p.parentId);
      });

      oldParentIds.forEach((pid) => {
        // 如果只是在同一个父节点下移动，忽略
        if (pid === targetParentId) return;

        // 获取原来的子节点（getChildren 返回的是移动前的状态）
        const children = getChildren(pid, activeNotebookId || undefined);
        // 排除掉正在拖走的
        const remaining = children.filter((p) => !dragIds.includes(p.id));
        
        if (remaining.length === 0) {
          setOpenPageIds((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
        }
      });
    },
    [getChildren, activeNotebookId, pages, reorderPages],
  );

  const handleRename = useCallback(
    ({ id, name }: { id: string; name: string }) => {
      const page = pages[id];
      if (!page) return;

      // 更新 content 第一行的标题
      const newContent = JSON.parse(JSON.stringify(page.content));
      if (
        newContent.content?.[0]?.type === "heading" &&
        newContent.content[0].attrs?.level === 1
      ) {
        newContent.content[0].content = name
          ? [{ type: "text", text: name }]
          : undefined;
        updatePage(id, { content: newContent });
      }
    },
    [pages, updatePage],
  );

  const handleActivate = useCallback(
    (node: NodeApi<TreeNode>) => {
      setActivePage(node.id);
    },
    [setActivePage],
  );

  const handleToggle = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getVisibleCount = (nodes: TreeNode[]): number => {
    let count = nodes.length;
    nodes.forEach((node) => {
      if (node.id && openPageIds.has(node.id) && node.children) {
        count += getVisibleCount(node.children);
      }
    });
    return count;
  };

  const visibleCount = useMemo(
    () => getVisibleCount(treeData),
    [treeData, openPageIds],
  );
  // Add buffer to ensure bottom drop zone is captureable even if mouse is slightly below the last item
  const contentHeight = visibleCount * rowHeight + 100;
  const treeHeight = Math.max(contentHeight, viewportHeight || 0);

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalNotebook = notebook?.source === "local-folder";

  if (treeData.length === 0) {
    return (
      <div className="text-sm text-muted-foreground dark:text-muted-foreground/65 px-4 py-8 text-center bg-gradient-to-br from-muted/40 to-muted/20 rounded mx-2 border border-dashed">
        <div className="mb-2">👻</div>
        <p>{isLocalNotebook ? "暂无文件" : "暂无页面"}</p>
        <Button
          variant="link"
          onClick={onCreatePage}
          className="h-auto p-0 mt-1"
        >
          {isLocalNotebook ? "创建第一个文件" : "创建第一个页面"}
        </Button>
      </div>
    );
  }

  return (
    <div className="sidebar-tree-container">
      <Tree
        ref={treeRef}
        data={treeData}
        onMove={handleMove}
        onRename={handleRename}
        onActivate={handleActivate}
        selection={activePageId || undefined}
        openByDefault={false}
        width={width}
        height={treeHeight}
        indent={18}
        rowHeight={rowHeight}
        overscanCount={5}
        disableEdit={false}
        disableDrag={false}
        disableDrop={({ parentNode }) => {
          if (parentNode.isRoot) return false;
          // In local folder mode, strictly prevent dropping into files
          if (isLocalNotebook) {
            return !parentNode.data.page?.isFolder;
          }
          // In virtual/cloud mode, any page can be a parent (Notion-style), so allow it
          return false;
        }}
        renderCursor={SidebarCursor}
        onToggle={handleToggle}
      >
        {(props) => (
          <PageNode
            {...props}
            itemHeight={itemHeight}
            activeNotebookId={activeNotebookId}
            onRequestRename={onRequestRename}
          />
        )}
      </Tree>
    </div>
  );
}

function SidebarCursor({ top, left, indent }: CursorProps) {
  // We align logical indent (18px) with visual indent (24px).
  // The cursor position corresponds directly to the visual level.
  const level = left / indent;
  const visualLeft = level * 24;

  return (
    <div
      className="sidebar-drop-cursor"
      style={{ top: top - 1, left: visualLeft, right: 12 }}
    >
      <div className="sidebar-drop-line" />
    </div>
  );
}
