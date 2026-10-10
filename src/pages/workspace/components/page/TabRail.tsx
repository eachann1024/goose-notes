import * as GooseIcons from "@/components/ui/icons";
import { activateWorkspace } from "@/lib/settings-navigation";
import { useTabs } from "@/stores/useTabs";
import { isFullscreenAiLayout } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { cn } from "@/lib/utils";
import { tabRailListClassName } from "./tabRailLayout";

import { useTabRail } from "./tab-rail/useTabRail";
import { SortableTabItem } from "./tab-rail/SortableTabItem";
import { tabRailPageId } from "./tab-rail/model";
import type { TabRailProps } from "./tab-rail/types";
export type { TabRailVariant } from "./tab-rail/types";

export function TabRail({
  variant,
  page,
  onOpenSearch,
  onBeforeActivateTab,
  settingsOpen = false,
  aiPanelOpen,
  aiLayoutMode = "fullscreen",
}: TabRailProps) {
  const {
    visibleTabs, focusedPageByTabId, getPage,
    activeTabId, isOverflowing, tabsScrollerRef,
    dragEnabled, insertLeft, sensors,
    handleTabDragStart, handleTabDragMove, handleTabDragCancel,
    handleTabDragEnd, closeTabShortcutLabel, editTitleInPill,
    canOpenInNewWindow, setActiveTab, closeTab,
    togglePinTab, promotePreviewTab, locateInTree,
    openTabInNewWindow, handleTabsWheel, handleTabListKeyDown,
    openTabs,
  } = useTabRail({ variant, settingsOpen, onBeforeActivateTab });

  const tabItems = (
    <>
      {visibleTabs.map((tab) => {
        const displayPageId = tabRailPageId(tab, focusedPageByTabId);
        const tabPage =
          tab.type === "welcome" ? undefined : getPage(displayPageId);
        const visibleIndex = visibleTabs.findIndex((t) => t.id === tab.id);
        return (
          <SortableTabItem
            key={tab.id}
            tab={{ ...tab, pageId: displayPageId }}
            tabPage={tabPage}
            tabCount={visibleTabs.length}
            variant={variant}
            isActive={
              activeTabId === tab.id &&
              !(aiPanelOpen && isFullscreenAiLayout(aiLayoutMode))
            }
            hasLeftTabs={visibleIndex > 0}
            hasRightTabs={visibleIndex < visibleTabs.length - 1}
            hasOtherTabs={visibleTabs.length > 1}
            closeTabShortcutLabel={closeTabShortcutLabel}
            editTitleInPill={editTitleInPill}
            dragEnabled={dragEnabled}
            onActivate={() => {
              onBeforeActivateTab?.();
              setActiveTab(tab.id);
            }}
            onClose={() => { activateWorkspace(); closeTab(tab.id); }}
            onCloseOthers={() => {
              activateWorkspace();
              visibleTabs
                .filter((item) => item.id !== tab.id)
                .forEach((item) => closeTab(item.id));
            }}
            onCloseLeft={() => {
              activateWorkspace();
              visibleTabs
                .slice(0, visibleIndex)
                .forEach((item) => closeTab(item.id));
            }}
            onCloseRight={() => {
              activateWorkspace();
              visibleTabs
                .slice(visibleIndex + 1)
                .forEach((item) => closeTab(item.id));
            }}
            onTogglePin={() => togglePinTab(tab.id)}
            onPromotePreview={() => promotePreviewTab(tab.id)}
            onLocateInTree={() => locateInTree(displayPageId)}
            onOpenInNewWindow={
              canOpenInNewWindow ? () => void openTabInNewWindow(tab) : undefined
            }
          />
        );
      })}
    </>
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        ref={tabsScrollerRef}
        role="tablist"
        aria-label="打开的标签页"
        className={cn(
          "relative @container min-w-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          tabRailListClassName(visibleTabs.length),
        )}
        onWheel={handleTabsWheel}
        onKeyDown={handleTabListKeyDown}
        onDoubleClick={(e) => {
          if (variant === "electron-titlebar") return;
          if (e.target === e.currentTarget) {
            onBeforeActivateTab?.();
            useTabs.getState().openNewTab();
          }
        }}
      >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleTabDragStart}
        onDragMove={handleTabDragMove}
        onDragCancel={handleTabDragCancel}
        onDragEnd={handleTabDragEnd}
      >
        <SortableContext
          items={visibleTabs.map((tab) => tab.id)}
          strategy={horizontalListSortingStrategy}
        >
          {tabItems}
        </SortableContext>
      </DndContext>
      {insertLeft != null && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 z-20 w-0.5 rounded-marker bg-primary motion-reduce:transition-none"
          style={{ left: insertLeft }}
        />
      )}

      {openTabs.length === 0 && page && (
        <span className="truncate text-sm text-foreground">
          {getPageTitle(page)}
        </span>
      )}
    </div>

      {!page?.trashedAt && (
        <div
          className="flex shrink-0 items-center gap-0.5"
          data-electron-no-drag={
            variant === "electron-titlebar" ? "" : undefined
          }
        >
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-[8px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  onClick={onOpenSearch}
                  aria-label="新标签页"
                >
                  <GooseIcons.Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>新标签页</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isOverflowing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="outline-none inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]"
                  aria-label="全部标签页"
                >
                  <GooseIcons.ChevronDown
                    className="h-3.5 w-3.5"
                    strokeWidth={1.75}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[220px] outline-none"
                align="end"
                sideOffset={4}
              >
                {visibleTabs.map((tab) => {
                  const displayPageId = tabRailPageId(tab, focusedPageByTabId);
                  const tabPage =
                    tab.type === "welcome" ? undefined : getPage(displayPageId);
                  const title =
                    tab.type === "welcome"
                      ? "新标签页"
                      : tabPage
                        ? getPageTitle(tabPage)
                        : "页面已不存在";
                  const isActive =
                    activeTabId === tab.id &&
                    !(aiPanelOpen && isFullscreenAiLayout(aiLayoutMode));
                  return (
                    <DropdownMenuItem
                      key={tab.id}
                      aria-selected={isActive}
                      className={cn(
                        "goose-interactive flex items-center gap-2 text-[13px]",
                        isActive &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]",
                      )}
                      onSelect={() => {
                        onBeforeActivateTab?.();
                        setActiveTab(tab.id);
                        setTimeout(() => {
                          const scroller = tabsScrollerRef.current;
                          if (!scroller) return;
                          const el = scroller.querySelector<HTMLElement>(
                            `[data-tab-id="${tab.id}"]`,
                          );
                          el?.scrollIntoView({
                            inline: "nearest",
                            block: "nearest",
                          });
                        }, 0);
                      }}
                    >
                      {tab.pinned && (
                        <GooseIcons.Pin
                          className="h-3 w-3 shrink-0 text-link"
                          strokeWidth={1.75}
                        />
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          tab.preview && "italic text-muted-foreground",
                        )}
                      >
                        {title}
                      </span>
                      {isActive && (
                        <GooseIcons.Check
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.75}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
