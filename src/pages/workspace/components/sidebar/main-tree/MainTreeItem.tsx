import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type HTMLProps,
  type MouseEvent,
  type PointerEvent,
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
import { IconSelector } from "../../shared/IconSelector";
import {
  canCustomizePageIcon,
  LocalFileIcon,
  shouldShowFolderExpandArrow,
} from "../local-file-icon";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { toggleSidebarFolder } from "@/stores/useSidebarView";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { isElectronHost } from "@/lib/local-vault";
import { isExternalFileDrag } from "@/lib/local-folder-target";
import { setLocalFolderFileDropTarget } from "@/lib/local-folder-file-drop-target";
import {
  MAIN_TREE_INDENT,
  MAIN_TREE_ROW_PADDING_LEFT,
  shouldHideSortLineForLocalFolder,
} from "./mainTreeDragGeometry";
import { MainTreeRowDisclosure, MainTreeRowShell } from "./MainTreeRowShell";
import {
  captureLocalFolderDropParent,
  peekLocalFolderDropParent,
  snapDragBetweenLine,
} from "./mainTreeLocalDrop";

const INDENT = MAIN_TREE_INDENT;
const ROW_PADDING_LEFT = MAIN_TREE_ROW_PADDING_LEFT;
let activeMainTreeDragId: string | null = null;

function TreeRowIcon({
  page,
  isLocalFolder,
  isRenaming,
  hasChildren,
  hideExpandArrows,
  isExpanded,
  onToggleExpanded,
}: {
  page: Page;
  isLocalFolder: boolean;
  isRenaming: boolean;
  hasChildren: boolean;
  hideExpandArrows: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const iconName = usePages((s) => {
    const live = s.pages[page.id];
    return live ? live.icon : page?.icon;
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
  const canCustomize = canCustomizePageIcon(page, isLocalFolder);
  const showExpandControl = shouldShowFolderExpandArrow({
    isFolder: !!page.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });

  const stopBubble = {
    onPointerDown: (e: PointerEvent) => {
      e.stopPropagation();
    },
    onMouseDown: (e: MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
    onDragStart: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };

  if (hideExpandArrows && showExpandControl && !isRenaming) {
    return (
      <button
        type="button"
        className="goose-hidden-expand-icon group/hidden-toggle relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] mr-0.5 transition-colors duration-150 hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] focus-visible:bg-[var(--goose-interactive-selected)] focus-visible:text-[var(--goose-interactive-selected-fg)]"
        draggable={false}
        aria-label={isExpanded ? "折叠子项" : "展开子项"}
        aria-expanded={isExpanded}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.button !== 0 || e.ctrlKey) return;
          onToggleExpanded();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // 键盘激活的 click 才补一次；指针已在 pointerdown 翻转，避免连点打成同向两次。
          if (e.detail === 0) onToggleExpanded();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="flex h-4 w-4 items-center justify-center transition-opacity duration-150 group-hover/main-row:opacity-0 group-focus-visible/hidden-toggle:opacity-0">
          {renderedIcon}
        </span>
        <LucideIcons.ChevronRight
          className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 text-muted-foreground/80 opacity-0 transition-[opacity,transform] duration-150 group-hover/main-row:opacity-100 group-focus-visible/hidden-toggle:opacity-100",
            isExpanded && "rotate-90",
          )}
        />
      </button>
    );
  }

  if (canCustomize && !isRenaming) {
    return (
      <IconSelector
        value={iconName}
        onChange={(newIcon) =>
          usePages.getState().updatePage(page.id, { icon: newIcon })
        }
      >
        <button
          type="button"
          className="goose-page-icon-trigger relative z-10 flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] focus-visible:bg-[var(--goose-interactive-selected)] focus-visible:text-[var(--goose-interactive-selected-fg)] transition-colors cursor-pointer shrink-0 mr-0.5"
          draggable={false}
          {...stopBubble}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="flex h-4 w-4 items-center justify-center">
            {renderedIcon}
          </div>
        </button>
      </IconSelector>
    );
  }

  if (isLocalFolder && page.isFolder && !hideExpandArrows) {
    return (
      <div className="main-tree-local-folder-icon flex items-center justify-center h-5 w-5 shrink-0 mr-0.5">
        {renderedIcon}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center mr-0.5"
      aria-disabled={isRenaming ? "true" : undefined}
    >
      <div className="flex h-4 w-4 items-center justify-center">
        {renderedIcon}
      </div>
    </div>
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
      style={{ paddingLeft: depth * INDENT + ROW_PADDING_LEFT }}
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
  const hideExpandArrows = useSettings.getState().hideExpandArrows;
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

  const iconNode = (
    <TreeRowIcon
      page={page}
      isLocalFolder={isLocalFolder}
      isRenaming={!!context.isRenaming}
      hasChildren={hasChildren}
      hideExpandArrows={hideExpandArrows}
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
    activeMainTreeDragId = String(item.index);
    onItemDragStart?.(String(item.index));

    const ghost = document.createElement("div");
    ghost.className = "main-tree-drag-ghost";
    const rowEl = (e.currentTarget as HTMLElement)
      .closest("li")
      ?.querySelector(".main-tree-row");
    // 跳过折叠箭头，取页面图标本体
    const iconSvg = rowEl?.querySelector("svg:not(.lucide-chevron-right)");
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
      openPageFromSidebar(pageId, permanent ? "permanent" : "preview");
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
      {hideExpandArrows ? null : arrow}
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
        <span className="relative z-10 truncate flex-1 min-w-0 pointer-events-none leading-snug">
          {title}
        </span>
      )}
    </MainTreeRow>
  );

  return (
    <li {...withChildren} className="list-none">
      <SidebarContextMenu
        page={page}
        onCreateLocalFile={onCreateLocalFile}
        onCreateLocalFolder={onCreateLocalFolder}
      >
        {row}
      </SidebarContextMenu>
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
  const page = item.data;
  const notebook = page?.workspaceId
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const showArrow = shouldShowFolderExpandArrow({
    isFolder: !!item.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });
  if (!showArrow) {
    // 占位区：不抢 hit area，让外层 row 的 interactive 覆盖层接管点击
    return (
      <span
        className="ml-1.5 w-5 h-5 shrink-0 pointer-events-none"
        aria-hidden="true"
      />
    );
  }
  return (
    <MainTreeRowDisclosure
      expanded={!!context.isExpanded}
      label={context.isExpanded ? "折叠子项" : "展开子项"}
      onToggle={() => toggleSidebarFolder(page.workspaceId, String(item.index))}
      nativeProps={context.arrowProps as HTMLProps<HTMLButtonElement>}
    />
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
  const { onDragOver, ...rest } = containerProps;
  return (
    <div
      {...rest}
      className="rct-main-tree outline-none min-h-full"
      onDragOver={(event) => {
        onDragOver?.(event);
        captureLocalFolderDropParent(event, event.currentTarget);
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
  const isLocalFolder = useNotebooks((state) => {
    const notebookId = state.activeNotebookId;
    return notebookId
      ? state.notebooks[notebookId]?.source === "local-folder"
      : false;
  });
  const parentItem =
    draggingPosition.targetType === "between-items" ||
    draggingPosition.targetType === "item"
      ? String(draggingPosition.parentItem)
      : undefined;
  const capturedParent = peekLocalFolderDropParent();
  const nestParent =
    capturedParent === null ? parentItem : capturedParent;
  const hideSortLine =
    isLocalFolder && shouldHideSortLineForLocalFolder(nestParent);

  useLayoutEffect(() => {
    const lineEl = lineRef.current;
    if (!lineEl) return;
    snapDragBetweenLine(lineEl, draggingPosition.linearIndex ?? 0);
  }, [draggingPosition.linearIndex, parentItem, hideSortLine]);

  if (hideSortLine) {
    return <div ref={lineRef} {...lineProps} className="hidden" />;
  }

  const depth = draggingPosition.depth ?? 0;
  const style = (lineProps.style ?? {}) as CSSProperties;
  const hideExpandArrows = useSettings.getState().hideExpandArrows;
  // 行结构：paddingLeft → (展开箭头槽位) → 图标。
  // 蓝点必须以图标左缘为起点，避免落在箭头区被误读成“成为子页面”。
  // 箭头槽：ml-1.5(6) + w-5(20) + gap-0.5(2) = 28
  const ARROW_SLOT = 6 + 20 + 2;
  const lineStart =
    depth * INDENT + ROW_PADDING_LEFT + (hideExpandArrows ? 0 : ARROW_SLOT);
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
