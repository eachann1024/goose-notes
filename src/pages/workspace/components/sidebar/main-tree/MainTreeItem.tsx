import type { HTMLProps, ReactNode } from "react";
import type {
  DraggingPosition,
  TreeInformation,
  TreeItem,
  TreeItemRenderContext,
} from "react-complex-tree";
import type { Page } from "@/types";
import { SidebarContextMenu } from "../SidebarContextMenu";
import { IconSelector } from "../../shared/IconSelector";
import { LocalFileIcon } from "../local-file-icon";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { getPageTitle } from "./treeAdapter";

const INDENT = 18;
const ROW_PADDING_LEFT = 6;

function TreeRowIcon({
  page,
  isLocalFolder,
  isRenaming,
}: {
  page: Page;
  isLocalFolder: boolean;
  isRenaming: boolean;
}) {
  const iconName = page?.icon;

  const stopBubble = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDragStart: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };

  if (isLocalFolder) {
    return (
      <div className="flex items-center justify-center h-5 w-5 shrink-0 mr-0.5">
        <LocalFileIcon page={page} iconName={iconName} isLocalFolder />
      </div>
    );
  }

  if (isRenaming) {
    return (
      <div
        className="flex h-6 w-6 items-center justify-center rounded-[6px] shrink-0 mr-0.5 pointer-events-none"
        aria-disabled="true"
      >
        <div className="flex h-4 w-4 items-center justify-center">
          <LocalFileIcon page={page} iconName={iconName} isLocalFolder={false} />
        </div>
      </div>
    );
  }

  return (
    <IconSelector
      value={iconName}
      onChange={(newIcon) =>
        usePages.getState().updatePage(page.id, { icon: newIcon })
      }
    >
      <div
        role="button"
        tabIndex={-1}
        title="点击更换图标"
        className="flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-muted-foreground/15 transition-colors cursor-pointer shrink-0 mr-0.5"
        draggable={false}
        {...stopBubble}
      >
        <div className="flex h-4 w-4 items-center justify-center">
          <LocalFileIcon page={page} iconName={iconName} isLocalFolder={false} />
        </div>
      </div>
    </IconSelector>
  );
}

interface RenderItemArgs {
  item: TreeItem<Page>;
  depth: number;
  children: ReactNode | null;
  title: ReactNode;
  arrow: ReactNode;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
}

export function renderItem({
  item,
  depth,
  children,
  arrow,
  context,
}: RenderItemArgs) {
  const page = item.data;
  if (item.index === "root") {
    return <>{children}</>;
  }
  const isActive = context.isSelected || context.isFocused;
  const isOver = context.isDraggingOver;
  const interactive = context.interactiveElementProps as HTMLProps<HTMLDivElement>;
  const withChildren = context.itemContainerWithChildrenProps as HTMLProps<HTMLLIElement>;
  const withoutChildren = context.itemContainerWithoutChildrenProps as HTMLProps<HTMLDivElement>;

  const title = getPageTitle(page);
  const notebook = page?.workspaceId
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";

  const iconNode = (
    <TreeRowIcon
      page={page}
      isLocalFolder={isLocalFolder}
      isRenaming={!!context.isRenaming}
    />
  );

  const row = (
    <div
      {...withoutChildren}
      {...interactive}
      className={cn(
        "main-tree-row group/main-row relative z-10 flex min-h-[28px] items-center gap-0.5 rounded-[8px] py-[4px] pl-0 pr-1.5",
        "text-[13px] font-medium leading-none cursor-pointer select-none",
        "transition-colors duration-150",
        "outline-none",
        isActive
          ? "bg-[var(--goose-interactive-selected)] text-foreground"
          : "text-muted-foreground dark:text-muted-foreground/65 hover:bg-[var(--goose-interactive-hover)] hover:text-foreground dark:hover:text-foreground/92",
        // drop 高亮：使用 workspace-drag-line token 调性，更克制
        isOver &&
          "bg-[hsl(var(--primary)/0.10)] ring-1 ring-[hsl(var(--primary)/0.38)] ring-inset",
      )}
      style={{ paddingLeft: depth * INDENT + ROW_PADDING_LEFT }}
    >
      {arrow}
      {iconNode}
      <span className="truncate flex-1 min-w-0">{title}</span>
    </div>
  );

  return (
    <li {...withChildren} className="list-none">
      <SidebarContextMenu page={page}>{row}</SidebarContextMenu>
      {children}
    </li>
  );
}

interface RenderArrowArgs {
  item: TreeItem<Page>;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
}

export function renderItemArrow({ item, context }: RenderArrowArgs) {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  if (!item.isFolder || !hasChildren) {
    return <span className="ml-1.5 w-5 h-5 shrink-0" aria-hidden="true" />;
  }
  const arrowProps = context.arrowProps as HTMLProps<HTMLSpanElement>;
  return (
    <span
      {...arrowProps}
      className="ml-1.5 inline-flex w-5 h-5 shrink-0 items-center justify-center rounded transition-all duration-200 ease-out hover:bg-muted-foreground/10 cursor-pointer"
      aria-hidden="true"
    >
      <LucideIcons.ChevronRight
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-200",
          context.isExpanded && "rotate-90",
        )}
      />
    </span>
  );
}

interface RenderItemsContainerArgs {
  children: ReactNode;
  containerProps: HTMLProps<HTMLUListElement>;
}

export function renderItemsContainer({
  children,
  containerProps,
}: RenderItemsContainerArgs) {
  return (
    <ul {...containerProps} className="list-none p-0 m-0 mt-0.5 space-y-0.5">
      {children}
    </ul>
  );
}

interface RenderTreeContainerArgs {
  children: ReactNode;
  containerProps: HTMLProps<HTMLDivElement>;
}

export function renderTreeContainer({
  children,
  containerProps,
}: RenderTreeContainerArgs) {
  return (
    <div {...containerProps} className="rct-main-tree outline-none space-y-0.5">
      {children}
    </div>
  );
}

interface RenderDragBetweenLineArgs {
  draggingPosition: DraggingPosition;
  lineProps: HTMLProps<HTMLDivElement>;
}

export function renderDragBetweenLine({
  draggingPosition,
  lineProps,
}: RenderDragBetweenLineArgs) {
  const depth = draggingPosition.depth ?? 0;
  const style = (lineProps.style ?? {}) as React.CSSProperties;
  return (
    <div
      {...lineProps}
      style={{
        ...style,
        marginLeft: depth * INDENT + ROW_PADDING_LEFT + 20,
        marginRight: 8,
      }}
      className="h-[2px] rounded-full bg-[hsl(var(--primary))] shadow-[0_0_8px_hsl(var(--primary)/0.35)]"
    />
  );
}
