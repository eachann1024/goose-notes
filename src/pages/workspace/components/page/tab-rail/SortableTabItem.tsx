import * as GooseIcons from "@/components/ui/icons";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import type { Page } from "@/types";
import { type TabItem } from "@/stores/useTabs";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { cn } from "@/lib/utils";
import { SingleTabTitle } from "../SingleTabTitle";
import { shouldHandleTabActivationKey, tabRailItemClassName, tabRailSelectionClassName } from "../tabRailLayout";
import { shouldEditTitleInTab } from "../visibleTabs";
import { bindIdleWindowDrag } from "@/lib/electron/windowDrag";

import type { TabRailVariant } from "./types";

interface SortableTabItemProps {
  tab: TabItem;
  tabPage?: Page;
  tabCount: number;
  variant: TabRailVariant;
  isActive: boolean;
  hasLeftTabs: boolean;
  hasRightTabs: boolean;
  hasOtherTabs: boolean;
  closeTabShortcutLabel: string;
  editTitleInPill: boolean;
  dragEnabled: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onTogglePin: () => void;
  onPromotePreview: () => void;
  onLocateInTree?: () => void;
  onOpenInNewWindow?: () => void;
}

export function SortableTabItem({
  tab,
  tabPage,
  tabCount,
  variant,
  isActive,
  hasLeftTabs,
  hasRightTabs,
  hasOtherTabs,
  closeTabShortcutLabel,
  editTitleInPill,
  dragEnabled,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseLeft,
  onCloseRight,
  onTogglePin,
  onPromotePreview,
  onLocateInTree,
  onOpenInNewWindow,
}: SortableTabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: !dragEnabled });
  const windowDragStartedRef = useRef(false);
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const title =
    tab.type === "welcome"
      ? "新标签页"
      : tabPage
        ? getPageTitle(tabPage)
        : "页面已不存在";
  const electronNoDrag = variant === "electron-titlebar";
  const windowDragEnabled = !dragEnabled && variant === "electron-titlebar";
  const onWindowDragPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!windowDragEnabled) return;
    bindIdleWindowDrag(event, windowDragStartedRef);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...(dragEnabled ? listeners : {})}
          aria-disabled={undefined}
          role="tab"
          tabIndex={isActive ? 0 : -1}
          aria-selected={isActive}
          data-tab-id={tab.id}
          data-tab-active={isActive || undefined}
          data-tab-page-id={tab.pageId}
          data-tab-preview={tab.preview || undefined}
          data-tab-pinned={tab.pinned || undefined}
          data-electron-no-drag={electronNoDrag ? "" : undefined}
          data-electron-option-drag={windowDragEnabled ? "" : undefined}
          onPointerDown={onWindowDragPointerDown}
          onClick={onActivate}
          onDoubleClick={(event) => {
            if (!tab.preview) return;
            event.preventDefault();
            event.stopPropagation();
            onPromotePreview();
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          onKeyDown={(event) => {
            if (shouldHandleTabActivationKey(event.key, event.target)) {
              event.preventDefault();
              onActivate();
            }
          }}
          className={cn(
            "group relative @container flex items-center gap-1 px-2 text-sm",
            tabCount > 1 && "goose-interactive",
            tabRailItemClassName(tabCount),
            tab.preview && "italic",
            isDragging && "cursor-grabbing",
            tabRailSelectionClassName(tabCount, isActive),
          )}
        >
          {tab.pinned && (
            <GooseIcons.Pin
              aria-label="已固定"
              className="h-3 w-3 shrink-0 text-link"
            />
          )}
          {isActive && shouldEditTitleInTab(tabPage, editTitleInPill) && tabPage ? (
            <SingleTabTitle
              key={`${tabPage.id}:${tabPage.localFilePath ?? ""}:${getPageTitle(tabPage)}`}
              page={tabPage}
              surface="tab-pill"
              idleWindowDrag={variant === "electron-titlebar"}
            />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate no-underline",
                tab.preview && "italic text-muted-foreground",
              )}
            >
              {title}
            </span>
          )}
          <TooltipProvider delayDuration={2000}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-md p-0 transition-colors",
                    tabPage
                      ? "hidden @[64px]:group-hover:flex"
                      : "flex",
                    isActive
                      ? "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                  }}
                  aria-label="关闭标签页"
                >
                  <GooseIcons.X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>关闭标签页</span>
                  {closeTabShortcutLabel && (
                    <span className="text-[11px] text-muted-foreground">
                      {closeTabShortcutLabel}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[200px]">
        {tab.type !== "welcome" && onLocateInTree && (
          <>
            <ContextMenuItem onSelect={onLocateInTree}>
              在文件树中定位
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onOpenInNewWindow ? (
          <ContextMenuItem onSelect={onOpenInNewWindow}>
            在新窗口打开
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={onTogglePin}>
          {tab.pinned ? "取消固定" : "固定标签"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose}>
          关闭
          {closeTabShortcutLabel && (
            <span className="ml-auto text-xs text-muted-foreground">
              {closeTabShortcutLabel}
            </span>
          )}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers} disabled={!hasOtherTabs}>
          关闭其他标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseLeft} disabled={!hasLeftTabs}>
          关闭左侧标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseRight} disabled={!hasRightTabs}>
          关闭右侧标签页
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
