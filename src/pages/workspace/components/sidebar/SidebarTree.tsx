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

interface SidebarTreeProps {
  activeNotebookId: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  onCreatePage: () => void;
  onboardingExpandPageId?: string | null;
  onOnboardingExpandDone?: () => void;
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
  parentId?: string,
  workspaceId?: string,
): TreeNode[] => {
  const children = Object.values(pages)
    .filter((p) => {
      const matchParent = p.parentId === parentId && !p.trashedAt;
      const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true;
      return matchParent && matchWorkspace;
    })
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));

  const nodes: TreeNode[] = children.map((page) => ({
    id: page.id,
    name: getPageTitle(page),
    icon: page.icon,
    children: buildTree(pages, openPageIds, page.id, workspaceId),
    page,
  }));

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
};

type PageNodeProps = NodeRendererProps<TreeNode> & {
  itemHeight: number;
  activeNotebookId: string | null;
};

function PageNode({
  node,
  style,
  dragHandle,
  itemHeight,
  activeNotebookId: _activeNotebookId,
}: PageNodeProps) {
  const { activePageId, setActivePage, createPage, pages, createLocalPage } =
    usePages();
  const notebookId = node.data.page?.workspaceId;
  const notebook = notebookId
    ? useNotebooks.getState().notebooks[notebookId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const isActive = activePageId === node.id;
  const isPlaceholder = node.data.isPlaceholder;
  const isDropTarget = node.willReceiveDrop && !isPlaceholder;
  const iconName = node.data.icon;
  const showFolderIcon = isLocalFolder && node.data.page?.isFolder;
  const childCount =
    node.data.children?.filter((child) => !child.isPlaceholder).length ?? 0;
  const showChildCount = childCount > 0;
  const displayChildCount = childCount > 9 ? "9+" : String(childCount);

  const { paddingLeft: _ignored, height: _ignoredHeight, ...itemStyle } = style;

  const indent = node.level * 16;
  const paddingLeft = indent;
  const rowStyle = { ...itemStyle, height: itemHeight };

  if (isPlaceholder) {
    return (
      <div style={rowStyle} className="relative px-1 select-none">
        <div className="flex items-center h-full px-2 rounded-md">
          <div
            style={{ paddingLeft: paddingLeft + 18 }}
            className="text-[13px] text-muted-foreground/45 italic truncate"
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

    const existingBlankChild = Object.values(pages).find((p) => {
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
      // 即使是复用空白页，也要聚焦标题
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
    } else {
      if (!node.isOpen) node.open();
      createPage(node.id, notebookId || DEFAULT_NOTEBOOK);
    }
  };

  return (
    <SidebarContextMenu page={node.data.page!}>
      <div ref={dragHandle} style={rowStyle} className="group relative px-1">
        <div
          className={cn(
            "relative flex items-center h-full px-2 rounded-md cursor-pointer transition-colors text-sm font-medium",
            isDropTarget && "sidebar-drop-target",
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
                      ) : showFolderIcon ? (
                        <LucideIcons.Folder className="h-4 w-4 text-muted-foreground/70" />
                      ) : (
                        <LucideIcons.File className="h-4 w-4 text-muted-foreground/70" />
                      )}
                    </>
                  )}
                </div>

                {!node.isOpen && (
                  <div className="hidden group-hover/icon:flex items-center justify-center">
                    <LucideIcons.ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                )}
              </div>
            </div>

            <span className="truncate text-sm flex-1 min-w-0">
              {node.data.name}
            </span>
          </div>

          <div className="ml-auto flex items-center pl-2 pr-1 shrink-0">
            <div className="relative w-5 h-5">
              {showChildCount && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none font-medium text-muted-foreground/50 bg-muted-foreground/10 rounded-full transition-opacity group-hover:opacity-0">
                  {displayChildCount}
                </span>
              )}
              <button
                className="absolute inset-0 p-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-muted-foreground/20 active:bg-muted-foreground/30 text-muted-foreground/70 hover:text-foreground transition-opacity"
                onClick={handleAddChild}
              >
                <LucideIcons.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
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
  onCreatePage,
  onboardingExpandPageId,
  onOnboardingExpandDone,
}: SidebarTreeProps) {
  const {
    pages,
    activePageId,
    setActivePage,
    updatePage,
    reorderPages,
    getChildren,
  } = usePages();
  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());
  const treeRef = useRef<TreeApi<TreeNode> | null>(null);

  useEffect(() => {
    if (!onboardingExpandPageId) return;
    const page = pages[onboardingExpandPageId];
    if (!page || page.trashedAt) {
      onOnboardingExpandDone?.();
      return;
    }
    if (activeNotebookId && page.workspaceId !== activeNotebookId) return;
    treeRef.current?.open(onboardingExpandPageId);
    onOnboardingExpandDone?.();
  }, [onboardingExpandPageId, pages, activeNotebookId, onOnboardingExpandDone]);

  const treeData = useMemo(
    () =>
      buildTree(pages, openPageIds, undefined, activeNotebookId || undefined),
    [pages, openPageIds, activeNotebookId],
  );

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
      newSiblings.splice(index, 0, ...movedPages);
      const newOrderIds = newSiblings.map((p) => p.id);
      reorderPages(newOrderIds, targetParentId);
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
  const treeHeight = visibleCount * rowHeight;

  if (treeData.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-4 py-8 text-center bg-muted/30 rounded mx-2 border border-dashed">
        <div className="mb-2">👻</div>
        <p>暂无页面</p>
        <Button
          variant="link"
          onClick={onCreatePage}
          className="h-auto p-0 mt-1"
        >
          创建第一个页面
        </Button>
      </div>
    );
  }

  return (
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
      indent={16}
      rowHeight={rowHeight}
      overscanCount={5}
      disableEdit={false}
      disableDrag={false}
      disableDrop={false}
      renderCursor={SidebarCursor}
      onToggle={handleToggle}
    >
      {(props) => (
        <PageNode
          {...props}
          itemHeight={itemHeight}
          activeNotebookId={activeNotebookId}
        />
      )}
    </Tree>
  );
}

function SidebarCursor({ top, left, indent }: CursorProps) {
  return (
    <div
      className="sidebar-drop-cursor"
      style={{ top: top - 1, left, right: indent }}
    >
      <div className="sidebar-drop-line" />
    </div>
  );
}
