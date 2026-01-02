import { Tree } from "react-arborist";
import type { NodeApi, NodeRendererProps } from "react-arborist";
import type { Page } from "@/types";
import { SidebarContextMenu } from "./SidebarContextMenu";

interface SidebarTreeProps {
  activeNotebookId: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  onCreatePage: () => void;
}

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
    name: page.title || "无标题",
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

function PageNode({ node, style, dragHandle, itemHeight, activeNotebookId }: PageNodeProps) {
  const { activePageId, setActivePage, createPage, pages } = usePages();
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

          <span className="truncate text-sm flex-1">{node.data.name}</span>
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
  );
}

export function SidebarTree({
  activeNotebookId,
  width,
  rowHeight,
  itemHeight,
  onCreatePage,
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

  const treeData = useMemo(
    () => buildTree(pages, openPageIds, undefined, activeNotebookId || undefined),
    [pages, openPageIds, activeNotebookId],
  );

  const handleMove = useCallback(
    ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      const targetParentId = parentId || undefined;
      const siblings = getChildren(targetParentId, activeNotebookId || undefined);
      const filteredSiblings = siblings.filter((p) => !dragIds.includes(p.id));
      const movedPages = dragIds.map((id) => pages[id]).filter(Boolean) as Page[];
      const newSiblings = [...filteredSiblings];
      newSiblings.splice(index, 0, ...movedPages);
      const newOrderIds = newSiblings.map((p) => p.id);
      reorderPages(newOrderIds, targetParentId);
    },
    [getChildren, activeNotebookId, pages, reorderPages],
  );

  const handleRename = useCallback(
    ({ id, name }: { id: string; name: string }) => {
      updatePage(id, { title: name });
    },
    [updatePage],
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
      data={treeData}
      onMove={handleMove}
      onRename={handleRename}
      onActivate={handleActivate}
      selection={activePageId || undefined}
      openByDefault={false}
      width={width}
      height={600}
      indent={16}
      rowHeight={rowHeight}
      overscanCount={5}
      disableEdit={false}
      disableDrag={false}
      disableDrop={false}
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
