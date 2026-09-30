import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type HTMLProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import type {
  DraggingPosition,
  TreeInformation,
  TreeItem,
  TreeItemRenderContext,
} from "react-complex-tree";
import type { Page } from "@/types";
import { SidebarContextMenu } from "../SidebarContextMenu";
import { SidebarInlineRename } from "../SidebarInlineRename";
import {
  isSidebarFolderRow,
  LocalFileIcon,
  shouldShowEmptyFolderPlaceholder,
  shouldShowFolderExpandArrow,
} from "../local-file-icon";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { toggleSidebarFolder } from "@/stores/useSidebarView";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { isElectronHost } from "@/lib/local-vault";
import { isExternalFileDrag } from "@/lib/local-folder-target";
import { setLocalFolderFileDropTarget } from "@/lib/local-folder-file-drop-target";
import {
  MAIN_TREE_INDENT,
  MAIN_TREE_ROW_PADDING_LEFT,
  normalizeMainTreeDragOver,
} from "./mainTreeDragGeometry";
import { MainTreeRowDisclosure, MainTreeRowShell } from "./MainTreeRowShell";
import { snapDragBetweenLine } from "./mainTreeLocalDrop";

const INDENT = MAIN_TREE_INDENT;
const ROW_PADDING_LEFT = MAIN_TREE_ROW_PADDING_LEFT;
/** 子行标题相对行起点：行内补偿 4px + 图标槽 18px + sidebar-design 行距 10px。 */
const CHILD_TITLE_OFFSET = 4 + INDENT + 10;
let activeMainTreeDragId: string | null = null;

function TreeRowIcon({
  page,
  isLocalFolder,
  isRenaming,
  hasChildren,
  isExpanded,
  onToggleExpanded,
}: {
  page: Page;
  isLocalFolder: boolean;
  isRenaming: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const iconName = usePages((s) => {
    const live = s.pages[page.id];
    return live ? live.icon : page?.icon;
  });
  // 文件夹占一个折叠槽和一个图标槽；子文件从自己的行起点放图标，
  // 因而正好与父文件夹的图标槽对齐，不额外缩进一列。
  const isFolderRow = isSidebarFolderRow({
    isFolder: !!page.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });
  const renderedIcon = (
    <LocalFileIcon
      page={page}
      iconName={iconName}
      isLocalFolder={isLocalFolder}
      hasChildren={hasChildren}
      isExpanded={isExpanded}
    />
  );
  const stopDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const blockDragStart = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span
      className="main-tree-row-icon-group pointer-events-none relative z-10 flex h-[18px] shrink-0 items-center gap-0"
      style={{ width: isFolderRow ? INDENT * 2 : INDENT, height: INDENT }}
    >
      {isFolderRow && !isRenaming ? (
        <MainTreeRowDisclosure
          expanded={isExpanded}
          label={isExpanded ? "折叠子项" : "展开子项"}
          onToggle={onToggleExpanded}
          className="ml-0 rounded-md pointer-events-auto"
          nativeProps={{
            draggable: false,
            style: { width: INDENT, height: INDENT },
            onDoubleClick: stopDoubleClick,
            onDragStart: blockDragStart,
          }}
        />
      ) : isFolderRow ? (
        <span
          className="main-tree-row-disclosure-placeholder shrink-0"
          style={{ width: INDENT, height: INDENT }}
          aria-hidden="true"
        />
      ) : null}
      <span className="main-tree-row-icon-slot pointer-events-none flex shrink-0 items-center justify-center">
        {renderedIcon}
      </span>
    </span>
  );
}

function MainTreeRow({
  withoutChildren,
  isLocalFolder,
  isPendingCreate,
  isActive,
  isOver,
  isDragging,
  depth,
  itemIndex,
  children,
}: {
  withoutChildren: HTMLProps<HTMLDivElement>;
  isLocalFolder: boolean;
  isPendingCreate: boolean;
  isActive: boolean;
  isOver: boolean;
  isDragging: boolean;
  depth: number;
  itemIndex: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isDragging) setHovered(false);
  }, [isDragging]);

  return (
    <MainTreeRowShell
      {...withoutChildren}
      onPointerEnter={() => {
        if (!isDragging) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onDragEnter={
        isLocalFolder
          ? (e) => {
              if (!isExternalFileDrag(e.dataTransfer)) return;
              e.preventDefault();
              setLocalFolderFileDropTarget(itemIndex);
            }
          : undefined
      }
      onDragOver={
        isLocalFolder
          ? (e) => {
              if (!isExternalFileDrag(e.dataTransfer)) return;
              e.preventDefault();
              setLocalFolderFileDropTarget(itemIndex);
            }
          : undefined
      }
      className={cn(
        withoutChildren.className,
        // 行高用 --main-tree-row-height 锁成整数，避免 margin/子像素让 rct
        // computeItemHeight 与真实行距不一致（Electron 越往下越拖不准）。
        isPendingCreate
          ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
          : "text-foreground",
        !isPendingCreate && !isDragging && hovered && "main-tree-row--hovered",
        isOver && "main-tree-row--drop-target",
        isDragging && "main-tree-row--dragging",
      )}
      active={!isPendingCreate && isActive}
      hovered={false}
      style={{ paddingLeft: depth * INDENT + ROW_PADDING_LEFT + 4 }}
    >
      {children}
    </MainTreeRowShell>
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
  onCreateLocalFile?: (parentId?: string) => void;
  onCreateLocalFolder?: (parentId?: string) => void;
  onCommitPendingCreate?: (id: string, name: string) => void;
  onCancelPendingCreate?: (id: string) => void;
  onItemDragStart?: (id: string) => void;
  onItemDragEnd?: () => void;
  onActivateLocalDirectory?: (
    id: string,
    mode: "preview" | "permanent",
  ) => void;
}

function PendingCreateNameInput({
  id,
  kind,
  onCommit,
  onCancel,
}: {
  id: string;
  kind: "folder" | "file";
  onCommit?: (id: string, name: string) => void;
  onCancel?: (id: string) => void;
}) {
  const defaultName = kind === "folder" ? "新建文件夹" : "未命名";
  const [value, setValue] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedRef = useRef(false);
  const readyToCommitBlurRef = useRef(false);

  useLayoutEffect(() => {
    const focusInput = (shouldSelect: boolean) => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (shouldSelect) input.select();
    };

    focusInput(true);
    const raf = window.requestAnimationFrame(() => {
      if (document.activeElement !== inputRef.current) {
        focusInput(true);
      }
    });
    const timer = window.setTimeout(() => {
      readyToCommitBlurRef.current = true;
      if (document.activeElement !== inputRef.current) {
        focusInput(true);
      }
    }, 280);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    const next = value.trim();
    if (!next) {
      committedRef.current = true;
      onCancel?.(id);
      return;
    }
    committedRef.current = true;
    onCommit?.(id, next);
  };

  return (
    <span className="relative z-20 flex min-w-0 flex-1 items-center">
      <input
        ref={inputRef}
        className="h-[22px] w-full min-w-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 text-sm leading-5 text-foreground outline-none focus:border-[hsl(var(--ring))]"
        value={value}
        placeholder={defaultName}
        draggable={false}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          if (!readyToCommitBlurRef.current) {
            window.requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            });
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (committedRef.current) return;
            committedRef.current = true;
            onCancel?.(id);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={kind === "folder" ? "文件夹名称" : "文件名称"}
      />
    </span>
  );
}

export function renderItem({
  item,
  depth,
  children,
  arrow,
  context,
  onCreateLocalFile,
  onCreateLocalFolder,
  onCommitPendingCreate,
  onCancelPendingCreate,
  onItemDragStart,
  onItemDragEnd,
  onActivateLocalDirectory,
}: RenderItemArgs) {
  const page = item.data;
  if (item.index === "root") {
    return <>{children}</>;
  }
  const isActive = !!context.isSelected;
  const isOver = !!context.isDraggingOver;
  const interactive =
    context.interactiveElementProps as HTMLProps<HTMLDivElement>;
  const withChildren =
    context.itemContainerWithChildrenProps as HTMLProps<HTMLLIElement>;
  const withoutChildren =
    context.itemContainerWithoutChildrenProps as HTMLProps<HTMLDivElement>;

  const title = getPageTitle(page);
  const notebook = page?.workspaceId
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isPendingCreate =
    page.localPendingCreate === "folder" || page.localPendingCreate === "file";
  const isLocalDirectory = isLocalFolder && !!page.isFolder;
  const isDragging = activeMainTreeDragId === String(item.index);
  const isFolderRow = isSidebarFolderRow({
    isFolder: !!page.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });
  // 空文件夹占位只在扫完之后才显示：读取中/失败时不能冒充空目录。
  const showEmptyFolderPlaceholder = shouldShowEmptyFolderPlaceholder({
    isFolderRow,
    isExpanded: !!context.isExpanded,
    hasChildren,
    isLocalNotebook: isLocalFolder,
    localLoadStatus: isLocalFolder
      ? useNotebooks.getState().localFolderLoadStates[page.workspaceId]?.status
      : undefined,
  });
  const iconNode = (
    <TreeRowIcon
      page={page}
      isLocalFolder={isLocalFolder}
      isRenaming={!!context.isRenaming}
      hasChildren={hasChildren}
      isExpanded={!!context.isExpanded}
      onToggleExpanded={() =>
        toggleSidebarFolder(page.workspaceId, String(item.index))
      }
    />
  );

  // 默认拖拽快照是整行 DOM（带选中背景的大块），跟随鼠标时会盖住目标行的
  // 拖入高亮，让人误以为不能拖成子页面。换成紧凑的"图标+标题"小胶囊，
  // 并弱化源行，让落点反馈始终可见。
  const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
    (
      interactive.onDragStart as
        | React.DragEventHandler<HTMLDivElement>
        | undefined
    )?.(e);
    if (!e.dataTransfer) return;
    if (page.localFilePath && !isPendingCreate && !page.localUnsaved) {
      e.dataTransfer.setData("text/plain", page.localFilePath);
      // 外部软件复制路径文本；应用内仍允许移动节点。
      e.dataTransfer.effectAllowed = "copyMove";
    }
    activeMainTreeDragId = String(item.index);
    onItemDragStart?.(String(item.index));

    const ghost = document.createElement("div");
    ghost.className = "main-tree-drag-ghost";
    const rowEl = (e.currentTarget as HTMLElement)
      .closest("li")
      ?.querySelector(".main-tree-row");
    // 跳过折叠箭头，取页面图标本体
    const iconSvg = rowEl?.querySelector(".main-tree-row-icon-slot svg");
    if (iconSvg) ghost.appendChild(iconSvg.cloneNode(true));
    const label = document.createElement("span");
    label.textContent = title || "无标题";
    ghost.appendChild(label);
    const grip = document.createElement("i");
    grip.className = "main-tree-drag-ghost-grip";
    grip.textContent = "⋮";
    ghost.appendChild(grip);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 18, 17);
    window.setTimeout(() => ghost.remove(), 0);

    if (rowEl instanceof HTMLElement) {
      rowEl.classList.add("main-tree-row--dragging", "main-tree-row--selected");
    }
    e.currentTarget.addEventListener(
      "dragend",
      () => {
        activeMainTreeDragId = null;
        onItemDragEnd?.();
        if (rowEl instanceof HTMLElement) {
          rowEl.classList.remove("main-tree-row--dragging");
        }
      },
      { once: true },
    );
  };

  const toggleLocalDirectory = () => {
    toggleSidebarFolder(page.workspaceId, String(item.index));
  };

  const handleRowPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    (
      interactive.onPointerDown as
        | React.PointerEventHandler<HTMLDivElement>
        | undefined
    )?.(e);
    if (!isLocalDirectory) return;
    if (e.button !== 0 || e.ctrlKey) return;
    if (e.detail <= 1) toggleLocalDirectory();
  };

  const handleRowClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (isLocalDirectory) {
      e.preventDefault();
      e.stopPropagation();
      // Electron：点击文件夹只展开/收起，不打开目录详情页。
      if (!isElectronHost) {
        const pageId = String(item.index);
        if (pageId && pageId !== "root") {
          onActivateLocalDirectory?.(
            pageId,
            e.metaKey || e.ctrlKey ? "permanent" : "preview",
          );
        }
      }
      // 指针已在 pointerdown 翻转；键盘（detail=0）在 click 补一次。
      if (e.detail === 0) toggleLocalDirectory();
      return;
    }
    (
      interactive.onClick as React.MouseEventHandler<HTMLDivElement> | undefined
    )?.(e);
    // 已选中再点时 tree 可能不触发 onSelectItems；全屏 AI 下仍需回到该页标签
    const pageId = String(item.index);
    if (pageId && pageId !== "root") {
      const permanent = e.metaKey || e.ctrlKey;
      openPageFromSidebar(pageId, permanent ? "permanent" : "preview", { newTab: permanent });
    }
  };

  const row = (
    <MainTreeRow
      withoutChildren={withoutChildren}
      isLocalFolder={isLocalFolder}
      isPendingCreate={isPendingCreate}
      isActive={isActive}
      isOver={isOver}
      isDragging={isDragging}
      depth={depth}
      itemIndex={String(item.index)}
    >
      {/* 整行作为 hit area：interactive div 绝对覆盖整个 row。
          arrow / icon 各自的实际可点击子节点已有自己的 pointer-events 与 stopPropagation，
          标题文字给 pointer-events-none 透传给底层 interactive；占位 arrow 已 pointer-events-none。 */}
      <div
        {...interactive}
        data-main-tree-folder={item.isFolder ? "true" : "false"}
        onClick={handleRowClick}
        onPointerDown={handleRowPointerDown}
        onDragStart={handleDragStart}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isLocalDirectory) {
            if (isElectronHost) return;
            // Electron：双击文件夹晋升永久标签（目录主页）
            onActivateLocalDirectory?.(String(item.index), "permanent");
            return;
          }
          openPageFromSidebar(String(item.index), "permanent");
        }}
        aria-label={title}
        className={cn(
          "absolute inset-0 rounded-lg outline-none",
          isPendingCreate && "pointer-events-none",
        )}
      />
      {iconNode}
      {/* leading-snug 抵消行容器的 leading-none：truncate(overflow hidden) 配 1 倍行高
          会把 g/y/p 等字母的降部裁掉 */}
      {isPendingCreate ? (
        <PendingCreateNameInput
          id={String(item.index)}
          kind={page.localPendingCreate === "file" ? "file" : "folder"}
          onCommit={onCommitPendingCreate}
          onCancel={onCancelPendingCreate}
        />
      ) : (
        <SidebarInlineRename>
          <span className="relative z-10 truncate flex-1 min-w-0 pointer-events-none leading-snug">
            {title}
          </span>
        </SidebarInlineRename>
      )}
    </MainTreeRow>
  );

  return (
    <li {...withChildren} className="list-none">
      <SidebarContextMenu
        page={page}
        isFolderRow={isFolderRow}
        onCreateLocalFile={onCreateLocalFile}
        onCreateLocalFolder={onCreateLocalFolder}
      >
        {row}
      </SidebarContextMenu>
      {children}
      {showEmptyFolderPlaceholder ? (
        <div
          className="flex items-center text-[13px] text-muted-foreground/70"
          style={{
            paddingLeft: (depth + 1) * INDENT + ROW_PADDING_LEFT + CHILD_TITLE_OFFSET,
            minHeight: "var(--main-tree-row-height)",
          }}
        >
          暂无文件
        </div>
      ) : null}
    </li>
  );
}

interface RenderArrowArgs {
  item: TreeItem<Page>;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
}

export function renderItemArrow() {
  return null;
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
  const { onDragOver, ...rest } = containerProps;
  return (
    <div
      {...rest}
      className="rct-main-tree outline-none min-h-full"
      onDragOver={(event) => {
        onDragOver?.(normalizeMainTreeDragOver(event, event.currentTarget));
      }}
    >
      {children}
    </div>
  );
}

interface RenderDragBetweenLineArgs {
  draggingPosition: DraggingPosition;
  lineProps: HTMLProps<HTMLDivElement>;
}

function MainTreeDragBetweenLine({
  draggingPosition,
  lineProps,
}: RenderDragBetweenLineArgs) {
  const lineRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const lineEl = lineRef.current;
    if (!lineEl) return;
    snapDragBetweenLine(lineEl, draggingPosition.linearIndex ?? 0);
  }, [draggingPosition]);

  const depth = draggingPosition.depth ?? 0;
  const style = (lineProps.style ?? {}) as CSSProperties;
  // 紧凑布局：文件夹本体承载展开控件，不额外保留箭头列。
  const lineStart = depth * INDENT + ROW_PADDING_LEFT;
  return (
    <div
      ref={lineRef}
      {...lineProps}
      style={{
        ...style,
        marginLeft: lineStart,
        marginRight: 8,
      }}
      className="main-tree-drop-between-line h-[2px] rounded-full"
    />
  );
}

export function renderDragBetweenLine(args: RenderDragBetweenLineArgs) {
  return <MainTreeDragBetweenLine {...args} />;
}
