import type { HTMLProps, ReactNode } from "react";
import type {
  DraggingPosition,
  TreeInformation,
  TreeItem,
  TreeItemRenderContext,
} from "react-complex-tree";
import type { Page } from "@/types";
import { SidebarContextMenu } from "../SidebarContextMenu";
import { getPageTitle } from "./treeAdapter";

const INDENT = 18;
const ROW_PADDING_LEFT = 6;

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
  const isPageFolder = !!page?.isFolder;
  const Icon = isPageFolder ? LucideIcons.Folder : LucideIcons.FileText;

  const row = (
    <div
      {...withoutChildren}
      {...interactive}
      className={cn(
        "group/main-row relative flex h-7 items-center gap-1 rounded-[8px] pr-1.5",
        "text-[13px] leading-none cursor-pointer select-none transition-colors",
        "outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary)/0.55)]",
        isActive
          ? "bg-[var(--goose-interactive-selected)] text-foreground"
          : "bg-transparent text-foreground/90 hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
        isOver &&
          "bg-[hsl(var(--primary)/0.18)] ring-1 ring-[hsl(var(--primary)/0.52)] ring-inset",
      )}
      style={{ paddingLeft: depth * INDENT + ROW_PADDING_LEFT }}
    >
      {arrow}
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isActive ? "text-foreground/80" : "text-foreground/55",
        )}
        aria-hidden="true"
      />
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
  if (!item.isFolder) {
    return <span className="w-5 h-5 shrink-0" aria-hidden="true" />;
  }
  const arrowProps = context.arrowProps as HTMLProps<HTMLSpanElement>;
  return (
    <span
      {...arrowProps}
      className="inline-flex w-5 h-5 shrink-0 items-center justify-center rounded text-foreground/55 hover:text-foreground/90 transition-colors"
      aria-hidden="true"
    >
      <LucideIcons.ChevronRight
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-150",
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
    <ul {...containerProps} className="list-none p-0 m-0">
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
    <div {...containerProps} className="rct-main-tree outline-none space-y-px">
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
