import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Settings as SettingsIcon, X } from "@/components/ui/icons";
import type { SettingsTab, SettingsTabConfig } from "./types";
import { cn } from "@/lib/utils";
import "./settings-layout.css";

interface SettingsScaffoldProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  tabs: SettingsTabConfig[];
  sidebarContainer: HTMLElement | null;
  mainContainer: HTMLElement | null;
  visible: boolean;
  children: ReactNode;
  feedbackBanner?: ReactNode;
  appsBanner?: ReactNode;
}

export function SettingsScaffold({
  activeTab,
  onTabChange,
  onClose,
  tabs,
  sidebarContainer,
  mainContainer,
  visible,
  children,
  feedbackBanner,
  appsBanner,
}: SettingsScaffoldProps) {
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(false);
  useLayoutEffect(() => {
    if (visible && !wasVisibleRef.current) {
      navigationRef.current?.querySelector<HTMLElement>('button[aria-current="page"]')?.focus({ preventScroll: true });
    }
    wasVisibleRef.current = visible;
  }, [visible, sidebarContainer]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef<Partial<Record<SettingsTab, number>>>({});
  const previousActiveTabRef = useRef<SettingsTab>(activeTab);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const previousActiveTab = previousActiveTabRef.current;
    if (!scrollContainer || previousActiveTab === activeTab) return;
    scrollPositionsRef.current[previousActiveTab] = scrollContainer.scrollTop;
    scrollContainer.scrollTop = scrollPositionsRef.current[activeTab] ?? 0;
    previousActiveTabRef.current = activeTab;
  }, [activeTab]);

  const handleTabChange = (tab: SettingsTab) => {
    if (scrollContainerRef.current) {
      scrollPositionsRef.current[activeTab] = scrollContainerRef.current.scrollTop;
    }
    onTabChange(tab);
  };

  return (
    <>
      {sidebarContainer && createPortal(
        <div ref={navigationRef} className="settings-sidebar-navigation flex h-full min-h-0 flex-col px-3 py-4 text-foreground" data-settings-navigation="" hidden={!visible} inert={!visible} aria-hidden={!visible}>
          <div className="flex shrink-0 items-center px-2 pb-4">
            <h1 className="text-base font-semibold">设置</h1>
          </div>
          <nav aria-label="设置分类" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "goose-interactive inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-sm",
                    activeTab === tab.id
                      ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>,
        sidebarContainer,
      )}
      {mainContainer && createPortal(
        <div
          className="settings-shell absolute inset-0 flex h-full min-h-0 flex-col text-foreground"
          hidden={!visible}
          inert={!visible}
          aria-hidden={!visible}
          data-settings=""
          data-settings-tab={activeTab}
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-[hsl(var(--goose-editor-bg))] px-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70">
              <SettingsIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold">设置</h2>
            <span className="text-xs text-muted-foreground">/ {tabs.find((tab) => tab.id === activeTab)?.label}</span>
            <button
              type="button"
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
              aria-label="关闭设置"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          {feedbackBanner || appsBanner ? (
            <div className="shrink-0 border-b border-border/70 px-5 py-2">
              {feedbackBanner}{appsBanner}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 bg-[hsl(var(--goose-shell-bg))]">
            <div
              ref={scrollContainerRef}
              onScroll={(event) => {
                scrollPositionsRef.current[activeTab] = event.currentTarget.scrollTop;
              }}
              className="settings-scroll h-full overflow-y-auto"
            >
              <div className="settings-panel min-h-0">{children}</div>
            </div>
          </div>
        </div>,
        mainContainer,
      )}
    </>
  );
}
