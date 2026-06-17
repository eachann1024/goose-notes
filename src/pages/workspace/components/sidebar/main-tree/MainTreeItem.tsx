import {
  useState,
  type DragEvent,
  type HTMLProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
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
import { useSettings } from "@/stores/useSettings";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { getPageTitle } from "./treeAdapter";

const INDENT = 18;
const ROW_PADDING_LEFT = 6;

function TreeRowIcon({
  page,
  isLocalFolder,
  isRenaming,
  hasChildren,
}: {
  page: Page;
  isLocalFolder: boolean;
  isRenaming: boolean;
  hasChildren: boolean;
}) {
  const [open, setOpen] = useState(false);
  const iconName = page?.icon;

  const stopBubble = {
    onPointerDown: (e: PointerEvent) => {
      e.stopPropagation();
      setOpen(true);
    },
    onMouseDown: (e: MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
    onDragStart: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };

  if (isLocalFolder) {
    return (
      <div className="flex items-center justify-center h-5 w-5 shrink-0 mr-0.5">
        <LocalFileIcon page={page} iconName={iconName} isLocalFolder hasChildren={hasChildren} />
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
          <LocalFileIcon page={page} iconName={iconName} isLocalFolder={false} hasChildren={hasChildren} />
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
      open={open}
      onOpenChange={setOpen}
    >
      <button
        type="button"
        className="relative z-10 flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-[var(--goose-icon-chip-on-selected)] dark:hover:bg-[var(--goose-interactive-hover)] transition-colors cursor-pointer shrink-0 mr-0.5"
        draggable={false}
        {...stopBubble}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <div className="flex h-4 w-4 items-center justify-center">
          <LocalFileIcon page={page} iconName={iconName} isLocalFolder={false} hasChildren={hasChildren} />
        </div>
      </button>
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
  const hideExpandArrows = useSettings.getState().hideExpandArrows;
  const page = item.data;
  if (item.index === "root") {
    return <>{children}</>;
  }
  const isActive = context.isSelected;
  const isOver = context.isDraggingOver;
  const interactive = context.interactiveElementProps as HTMLProps<HTMLDivElement>;
  const withChildren = context.itemContainerWithChildrenProps as HTMLProps<HTMLLIElement>;
  const withoutChildren = context.itemContainerWithoutChildrenProps as HTMLProps<HTMLDivElement>;

  const title = getPageTitle(page);
  const notebook = page?.workspaceId
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  const iconNode = (
    <TreeRowIcon
      page={page}
      isLocalFolder={isLocalFolder}
      isRenaming={!!context.isRenaming}
      hasChildren={hasChildren}
    />
  );

  // 默认拖拽快照是整行 DOM（带选中背景的大块），跟随鼠标时会盖住目标行的
  // 拖入高亮，让人误以为不能拖成子页面。换成紧凑的"图标+标题"小胶囊，
  // 并弱化源行，让落点反馈始终可见。
  const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
    (interactive.onDragStart as React.DragEventHandler<HTMLDivElement> | undefined)?.(e);
    if (!e.dataTransfer) return;

    const ghost = document.createElement("div");
    ghost.className = "main-tree-drag-ghost";
    const rowEl = (e.currentTarget as HTMLElement).closest("li")?.querySelector(".main-tree-row");
    // 跳过折叠箭头，取页面图标本体
    const iconSvg = rowEl?.querySelector("svg:not(.lucide-chevron-right)");
    if (iconSvg) ghost.appendChild(iconSvg.cloneNode(true));
    const label = document.createElement("span");
    label.textContent = title || "无标题";
    ghost.appendChild(label);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 14);
    window.setTimeout(() => ghost.remove(), 0);

    if (rowEl instanceof HTMLElement) {
      rowEl.style.opacity = "0.45";
      e.currentTarget.addEventListener(
        "dragend",
        () => {
          rowEl.style.opacity = "";
        },
        { once: true },
      );
    }
  };

  const row = (
    <div
      {...withoutChildren}
      className={cn(
        // mb-0.5 承担行间距：react-complex-tree 的 computeItemHeight 会把本元素的
        // margin 计入行高（offsetHeight + max(marginTop, marginBottom)）。
        // 间距放在 ul 的 space-y 上不会被测到，导致拖拽位置判定逐行累积偏差，
        // 越往下越拖不准，最后一行永远无法 drop 成子页面。
        "main-tree-row group/main-row relative z-10 mb-0.5 flex min-h-[28px] items-center gap-0.5 rounded-[8px] py-[4px] pl-0 pr-1.5",
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
      {/* 整行作为 hit area：interactive div 绝对覆盖整个 row。
          arrow / icon 各自的实际可点击子节点已有自己的 pointer-events 与 stopPropagation，
          标题文字给 pointer-events-none 透传给底层 interactive；占位 arrow 已 pointer-events-none。 */}
      <div
        {...interactive}
        onDragStart={handleDragStart}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isLocalFolder && page?.isFolder) {
            if (hasChildren) {
              context.toggleExpandedState();
            } else {
              toast.info("这个文件夹是空的", { position: "top-right" });
            }
            return;
          }
          openPageFromSidebar(String(item.index), "permanent");
        }}
        aria-label={title}
        className="absolute inset-0 rounded-[8px] outline-none"
      />
      {hideExpandArrows ? null : arrow}
      {iconNode}
      {/* leading-snug 抵消行容器的 leading-none：truncate(overflow hidden) 配 1 倍行高
          会把 g/y/p 等字母的降部裁掉 */}
      <span className="relative z-10 truncate flex-1 min-w-0 pointer-events-none leading-snug">
        {title}
      </span>
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
  const hideExpandArrows = useSettings.getState().hideExpandArrows;
  if (hideExpandArrows) {
    return null;
  }
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  if (!item.isFolder || !hasChildren) {
    // 占位区：不抢 hit area，让外层 row 的 interactive 覆盖层接管点击
    return (
      <span
        className="ml-1.5 w-5 h-5 shrink-0 pointer-events-none"
        aria-hidden="true"
      />
    );
  }
  const arrowProps = context.arrowProps as HTMLProps<HTMLSpanElement>;
  return (
    <span
      {...arrowProps}
      className="relative z-10 ml-1.5 inline-flex w-5 h-5 shrink-0 items-center justify-center rounded transition-all duration-200 ease-out hover:bg-[var(--goose-icon-chip-on-selected)] dark:hover:bg-[var(--goose-interactive-hover)] cursor-pointer"
      aria-hidden="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // 库默认 arrow onClick 会 selectItem → 触发 onSelectItems 切页；展开/收起不应导航
        context.toggleExpandedState();
      }}
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
    <div {...containerProps} className="rct-main-tree outline-none">
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
