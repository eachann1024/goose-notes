import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Settings as SettingsIcon, X } from "lucide-react";
import type { SettingsTab, SettingsTabConfig } from "./types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./settings-layout.css";

interface SettingsScaffoldProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  tabs: SettingsTabConfig[];
  children: ReactNode;
  feedbackBanner?: ReactNode;
  appsBanner?: ReactNode;
}

export function SettingsScaffold({
  activeTab,
  onTabChange,
  onClose,
  tabs,
  children,
  feedbackBanner,
  appsBanner,
}: SettingsScaffoldProps) {
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
    <div
      className="workspace-shell settings-shell flex h-full min-h-0 flex-col text-foreground"
      data-settings=""
      data-settings-tab={activeTab}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-[hsl(var(--goose-editor-bg))] px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70">
          <SettingsIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="text-base font-semibold">设置</h1>
        <span className="text-xs text-muted-foreground">/ {tabs.find((tab) => tab.id === activeTab)?.label}</span>
        <button
          type="button"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="关闭设置"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <nav aria-label="设置分类" className="settings-tabs flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 bg-[hsl(var(--goose-editor-bg))] px-5 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "goose-interactive h-9 shrink-0 gap-2 rounded-lg px-3 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                activeTab === tab.id
                  ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                  : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </nav>

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
    </div>
  );
}
