/**
 * TreeRow.tsx
 * 侧边树单行组件集合：
 *  - SortablePageRow：可排序/拖拽的页面行
 *  - EdgeDropZone：顶/底边缘拖放区
 *  - PlaceholderRow：空文件夹占位行
 */
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import * as LucideIcons from "lucide-react";
import { useEffect, useState } from "react";
import type {
  CSSProperties,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { requestPageTitleFocus } from "@/lib/page-title-focus";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { isElectronHost } from "@/lib/local-vault";
import { closeNotebookAiIfFullscreen } from "../../notebook-ai/useNotebookAiPanel";
import { useTabs } from "@/stores/useTabs";
import type { FlatTreeItem } from "../tree-dnd";
import { InlineOverflowRevealText } from "../InlineOverflowRevealText";
import { SidebarContextMenu } from "../SidebarContextMenu";
import {
  LocalFileIcon,
  shouldRenderExpandArrowSlot,
  shouldShowFolderExpandArrow,
} from "../local-file-icon";
import { TREE_INDENT } from "./useTreeDnd";

// 与主树 MainTreeItem.ROW_PADDING_LEFT 对齐；收藏平铺行不占展开箭头槽
const ROW_PADDING_LEFT = 6;

const DEFAULT_NOTEBOOK = "default-notebook";

// ─── EdgeDropZone ─────────────────────────────────────────────────────────

export function EdgeDropZone({
  id,
  top,
  height,
}: {
  id: string;
  top: number;
  height: number;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="pointer-events-none absolute left-0 right-0"
      style={{ top, height }}
    />
  );
}

// ─── PlaceholderRow ───────────────────────────────────────────────────────

export function PlaceholderRow({
  style,
  depth,
  name,
}: {
  style: CSSProperties;
  depth: number;
  name: string;
}) {
  return (
    <div style={style} className="relative px-0 select-none">
      <div className="flex items-center h-full pl-1 pr-2 rounded-md">
        <div
          style={{ paddingLeft: depth * TREE_INDENT + 24 }}
          className="text-muted-foreground/45 italic truncate"
        >
          {name}
        </div>
      </div>
    </div>
  );
}

// ─── SortablePageRow ──────────────────────────────────────────────────────

export interface SortablePageRowProps {
  item: FlatTreeItem;
  rowStyle: CSSProperties;
  depth: number;
  itemHeight: number;
  isLocalNotebook: boolean;
  isActive: boolean;
  isNestDropTarget: boolean;
  showDropLine: boolean;
  dropLinePosition: "top" | "bottom";
  dropLineLeft: number;
  onToggleOpen: (id: string) => void;
  showExpandControls?: boolean;
  showAddChildButton: boolean;
  dragEnabled: boolean;
  titleText: string;
  expandedTitleText?: string;
  revealResetSignal: number;
  titleRevealDisabled: boolean;
}

export function SortablePageRow({
  item,
  rowStyle,
  depth,
  itemHeight,
  isLocalNotebook,
  isActive,
  isNestDropTarget,
  showDropLine,
  dropLinePosition,
  dropLineLeft,
  onToggleOpen,
  showExpandControls = true,
  showAddChildButton,
  dragEnabled,
  titleText,
  expandedTitleText,
  revealResetSignal,
  titleRevealDisabled,
}: SortablePageRowProps) {
  const { setNodeRef, attributes, listeners, transition, isDragging } =
    useSortable({ id: item.id, disabled: !dragEnabled });
  const guardedListeners = dragEnabled
    ? {
        ...listeners,
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.button !== 0 || event.ctrlKey) return;
          listeners?.onPointerDown?.(event);
        },
      }
    : undefined;
  const sortableHandlers = dragEnabled
    ? {
        ...attributes,
        ...(guardedListeners ?? {}),
      }
    : {};

  const createPage = usePages((state) => state.createPage);
  const createLocalPage = usePages((state) => state.createLocalPage);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const openInCurrentTab = useTabs((state) => state.openInCurrentTab);

  const hideExpandArrows = useSettings((s) => s.hideExpandArrows);
  const page = item.page;
  const hasChildren = item.hasChildren;
  const isLocalFolder = isLocalNotebook;
  const showArrow =
    showExpandControls &&
    shouldShowFolderExpandArrow({
      isFolder: !!page.isFolder,
      hasChildren,
      isLocalNotebook: isLocalFolder,
    });
  const reserveExpandSlot = shouldRenderExpandArrowSlot({
    showExpandControls,
    hideExpandArrows,
  });
  const iconCarriesExpand = showExpandControls && hideExpandArrows && showArrow;
  const iconName = usePages((s) => {
    const live = s.pages[page.id];
    return live ? live.icon : page.icon;
  });
  const displayHasChildren = usePages((s) => {
    const pid = page.id;
    for (const p of Object.values(s.pages)) {
      if (p.parentId === pid && !p.trashedAt) return true;
    }
    return false;
  });

  // 拖动时原行留在树中作为位置锚点，真正跟随指针的内容由 DragOverlay 渲染。
  // 这能保留父子结构和原始位置，避免整行“被拔走”后只剩一块空白。
  const virtualTransform =
    typeof rowStyle.transform === "string" ? rowStyle.transform : "";
  const mergedTransform = virtualTransform;
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);

  useEffect(() => {
    if (isDragging) setRowHovered(false);
  }, [isDragging]);

  const handleAddChild = (e: MouseEvent) => {
    e.stopPropagation();
    closeNotebookAiIfFullscreen();

    if (isLocalFolder) {
      void createLocalPage(page.id, activeNotebookId || undefined);
      if (!item.isOpen) {
        onToggleOpen(page.id);
      }
      return;
    }

    const currentPages = usePages.getState().pages;
    const existingBlankChild = Object.values(currentPages).find((p) => {
      const isChild = p.parentId === page.id && !p.trashedAt;
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
      if (!item.isOpen) {
        onToggleOpen(page.id);
      }
      openInCurrentTab(existingBlankChild.id);
      requestPageTitleFocus(existingBlankChild.id);
      if (!effectiveSingleTabMode()) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("goose-note:focus-editor-start"),
          );
        }, 100);
      }
      return;
    }

    if (!item.isOpen) {
      onToggleOpen(page.id);
    }
    const newId = createPage(page.id, activeNotebookId || DEFAULT_NOTEBOOK);
    if (!newId) return;
    openInCurrentTab(newId);
  };

  const handleArrowPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!showArrow) return;
    if (event.button !== 0 || event.ctrlKey) return;
    onToggleOpen(page.id);
  };

  const handleArrowClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Keyboard-triggered click has detail=0.
    if (event.detail === 0 && showArrow) {
      onToggleOpen(page.id);
    }
  };

  const handleHiddenArrowPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!showArrow) return;
    if (event.button !== 0 || event.ctrlKey) return;
    onToggleOpen(page.id);
  };

  const handleHiddenArrowClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0 && showArrow) {
      onToggleOpen(page.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...rowStyle,
        height: itemHeight,
        transform: mergedTransform,
        transition,
      }}
      onPointerEnter={() => setRowHovered(true)}
      onPointerLeave={() => setRowHovered(false)}
      className={cn(
        "goose-sidebar-tree-row group relative px-0",
        isDragging &&
          "goose-sidebar-tree-row--dragging z-20 pointer-events-none",
      )}
    >
      {isNestDropTarget && (
        <div className="sidebar-tree-nest-target pointer-events-none absolute -inset-x-0.5 -inset-y-[2px] z-10 rounded-[10px]" />
      )}
      {showDropLine && (
        <div
          className="sidebar-tree-drop-line pointer-events-none absolute z-[35] h-[2px] rounded-full"
          style={{
            left: dropLineLeft,
            right: 12,
            top: dropLinePosition === "top" ? 0 : undefined,
            bottom: dropLinePosition === "bottom" ? 0 : undefined,
          }}
        />
      )}

      <SidebarContextMenu page={page}>
        <div
          {...sortableHandlers}
          className={cn(
            "sidebar-tree-row relative z-20 flex items-center h-full rounded-lg pl-0 pr-2 overflow-hidden cursor-pointer transition-colors text-[13px] font-medium leading-none",
            isNestDropTarget && "sidebar-drop-parent-target",
            isDragging && "sidebar-tree-source-placeholder cursor-grabbing",
            !isActive && "text-foreground",
            isActive && "sidebar-tree-row--selected",
            !isActive &&
              !isDragging &&
              rowHovered &&
              "sidebar-tree-row--hovered",
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (
              showExpandControls &&
              isElectronHost &&
              isLocalNotebook &&
              page.isFolder
            ) {
              onToggleOpen(page.id);
              return;
            }
            // 收藏等复用 SidebarTree 的区域不应为识别双击而延迟单击。
            // 双击随后会把这次即时打开的预览标签晋升为永久标签。
            openPageFromSidebar(
              page.id,
              e.metaKey || e.ctrlKey ? "permanent" : "preview",
            );
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (
              showExpandControls &&
              isElectronHost &&
              isLocalNotebook &&
              page.isFolder
            )
              return;
            openPageFromSidebar(page.id, "permanent");
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              if (
                showExpandControls &&
                isElectronHost &&
                isLocalNotebook &&
                page.isFolder
              ) {
                onToggleOpen(page.id);
                return;
              }
              openPageFromSidebar(page.id, "permanent");
            }
          }}
        >
          <div
            className="flex items-center h-full flex-1 min-w-0"
            style={{ paddingLeft: depth * TREE_INDENT + ROW_PADDING_LEFT }}
          >
            {reserveExpandSlot ? (
              <button
                type="button"
                aria-label={item.isOpen ? "折叠子页面" : "展开子页面"}
                aria-expanded={item.isOpen}
                className={cn(
                  "ml-1.5 flex items-center justify-center w-5 h-5 shrink-0 rounded border-0 bg-transparent p-0 transition-all duration-300 ease-out",
                  showArrow
                    ? "hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] cursor-pointer"
                    : "opacity-0 pointer-events-none",
                )}
                onPointerDown={handleArrowPointerDown}
                onClick={handleArrowClick}
              >
                <LucideIcons.ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-150 ease-out",
                    item.isOpen && "rotate-90",
                  )}
                />
              </button>
            ) : null}

            {iconCarriesExpand ? (
              <button
                type="button"
                aria-label={item.isOpen ? "折叠子项" : "展开子项"}
                aria-expanded={item.isOpen}
                className="goose-hidden-expand-icon group/hidden-toggle relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] mr-0.5 transition-colors duration-150 hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] focus-visible:bg-[var(--goose-interactive-selected)] focus-visible:text-[var(--goose-interactive-selected-fg)]"
                onPointerDown={handleHiddenArrowPointerDown}
                onClick={handleHiddenArrowClick}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center transition-opacity duration-150 group-hover:opacity-0 group-focus-visible/hidden-toggle:opacity-0">
                  <LocalFileIcon
                    page={page}
                    iconName={iconName}
                    isLocalFolder={isLocalFolder}
                    hasChildren={displayHasChildren}
                    isExpanded={item.isOpen}
                  />
                </span>
                <LucideIcons.ChevronRight
                  className={cn(
                    "pointer-events-none absolute h-3.5 w-3.5 text-muted-foreground/80 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-focus-visible/hidden-toggle:opacity-100",
                    item.isOpen && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <div className="pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center mr-0.5">
                <LocalFileIcon
                  page={page}
                  iconName={iconName}
                  isLocalFolder={isLocalFolder}
                  hasChildren={displayHasChildren}
                  isExpanded={item.isOpen}
                />
              </div>
            )}

            <InlineOverflowRevealText
              className="text-[13px] leading-snug"
              text={titleText}
              expandedText={expandedTitleText}
              active={isActive || rowHovered}
              disabled={titleRevealDisabled}
              resetSignal={revealResetSignal}
              onExpandedChange={setTitleExpanded}
            />
          </div>

          {showAddChildButton && (
            <div
              className={cn(
                "ml-1 items-center shrink-0",
                titleExpanded
                  ? "hidden"
                  : isNestDropTarget
                    ? "flex"
                    : "hidden group-hover:flex",
              )}
            >
              {isNestDropTarget && (
                <span className="sidebar-tree-nest-label mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  松手移入子页面
                </span>
              )}
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]"
                onClick={handleAddChild}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <LucideIcons.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </SidebarContextMenu>
    </div>
  );
}

export function TreeDragOverlay({
  item,
  width,
  isLocalNotebook,
  showExpandControls = true,
}: {
  item: FlatTreeItem;
  width: number;
  isLocalNotebook: boolean;
  showExpandControls?: boolean;
}) {
  const title = getPageTitle(item.page);
  const showOverlayArrow =
    showExpandControls &&
    shouldShowFolderExpandArrow({
      isFolder: !!item.page.isFolder,
      hasChildren: item.hasChildren,
      isLocalNotebook,
    });

  return (
    <div
      className="sidebar-tree-drag-overlay"
      style={{ width: Math.max(160, Math.min(width - 18, 320)) }}
      aria-hidden="true"
    >
      {showExpandControls ? (
        <span className="sidebar-tree-drag-overlay-leading">
          {showOverlayArrow ? (
            <LucideIcons.ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </span>
      ) : null}
      <span className="sidebar-tree-drag-overlay-icon">
        <LocalFileIcon
          page={item.page}
          iconName={item.page.icon}
          isLocalFolder={isLocalNotebook}
          hasChildren={item.hasChildren}
          isExpanded={item.isOpen}
        />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium leading-snug">
        {title}
      </span>
      <LucideIcons.GripVertical className="sidebar-tree-drag-overlay-grip h-4 w-4 shrink-0" />
    </div>
  );
}
