import { renderSidebarViews } from "./sidebar-shell/renderSidebarViews";
import { SettingsDialog } from "./SettingsDialog";
import { SidebarResizeEdge } from "./SidebarResizeEdge";
import "./sidebar-layout.css";
import { type SidebarProps } from "./sidebar-shell/shared";
import { useSidebarLayout } from "./sidebar-shell/useSidebarLayout";
import { useSidebarNavigation } from "./sidebar-shell/useSidebarNavigation";
import { useSidebarLifecycle } from "./sidebar-shell/useSidebarLifecycle";

export function Sidebar(props: SidebarProps) {
  const layout = useSidebarLayout(props);
  const navigation = useSidebarNavigation(layout);
  const sidebarLifecycleContext = useSidebarLifecycle(navigation);
  const context = sidebarLifecycleContext;
  const {
    className,
    disableResize,
    settingsOpen,
    onSettingsOpenChange,
    settingsTab,
    onSettingsTabChange,
    settingsMainHost,
    activeTab,
    sidebarCollapsed,
    sidebarOverlay,
    sidebarRef,
    width,
    minWidth,
    maxWidth,
    isResizing,
    handleResizePointerDown,
    handleResizeKeyDown,
    settingsSidebarHost,
    closeSidebarOverlay,
  } = context;

  return (
    <>
      {sidebarOverlay && (
        <button
          type="button"
          className="sidebar-overlay-backdrop"
          aria-label="关闭导航面板"
          tabIndex={-1}
          onClick={closeSidebarOverlay}
        />
      )}
      <div
        ref={sidebarRef}
        className={cn(
          "pb-0 h-full flex flex-col relative group/sidebar",
          sidebarCollapsed && "pointer-events-none",
          className,
        )}
        data-sidebar-resizing={isResizing || undefined}
        style={{
          width: sidebarCollapsed ? 0 : "var(--sidebar-configured-width)",
          minWidth: 0,
          opacity: sidebarCollapsed ? 0 : 1,
          transform: sidebarCollapsed ? "translateX(-8px)" : "translateX(0)",
          overflow: sidebarCollapsed ? "hidden" : "visible",
        }}
        aria-hidden={sidebarCollapsed}
        inert={sidebarCollapsed}
      >
        {!disableResize && !sidebarCollapsed && (
          <SidebarResizeEdge
            width={width}
            minWidth={minWidth}
            maxWidth={maxWidth}
            isResizing={isResizing}
            onPointerDown={handleResizePointerDown}
            onKeyDown={handleResizeKeyDown}
          />
        )}

        <div
          className="sidebar-size-container flex h-full min-h-0 flex-col"
          style={{
            width: sidebarOverlay ? "100%" : "var(--sidebar-configured-width)",
            minWidth: sidebarOverlay ? 0 : "var(--sidebar-configured-width)",
          }}
        >
          {renderSidebarViews(context)}
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={onSettingsOpenChange}
            activeTab={settingsTab}
            onTabChange={onSettingsTabChange}
            sidebarContainer={settingsSidebarHost}
            mainContainer={settingsMainHost}
          />
        </div>
      </div>
    </>
  );
}
