import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Settings as SettingsIcon, X } from "lucide-react";
import type { SettingsTab, SettingsTabConfig } from "./types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isElectronRuntime } from "@/lib/electron/runtime";

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
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollPositionsRef.current[activeTab] = scrollContainer.scrollTop;
    }

    onTabChange(tab);
  };

  const handleScroll = () => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollPositionsRef.current[activeTab] = scrollContainer.scrollTop;
    }
  };

  return (
    <div
      className="workspace-shell flex h-full flex-col bg-[hsl(var(--goose-shell-bg))] text-foreground"
      data-settings=""
    >
      <div
        className={
          isElectronRuntime()
            ? "electron-titlebar flex w-full items-center justify-between gap-8 bg-[hsl(var(--goose-shell-bg))] pl-[var(--electron-traffic-inset,78px)] pr-3"
            : "flex h-14 w-full items-center justify-between gap-8 bg-[hsl(var(--goose-shell-bg))] px-6"
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]">
            <SettingsIcon className="h-4 w-4 text-foreground" />
          </div>
          <h1 className="truncate text-lg font-semibold leading-none text-foreground">
            设置
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground/75 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="workspace-stage min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div className="workspace-main-sheet flex w-full shrink-0 flex-col md:w-60 overflow-hidden rounded-[16px] bg-[hsl(var(--goose-shell-bg))]">
          <nav
            aria-label="设置分类"
            className="flex gap-1 overflow-x-auto p-3 md:block md:flex-1 md:space-y-1"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "goose-interactive h-auto w-auto shrink-0 justify-start gap-3 md:w-full rounded-[10px] px-3 py-2.5 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeTab === tab.id
                      ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </Button>
              );
            })}
          </nav>

          {feedbackBanner || appsBanner ? (
            <div className="space-y-3 p-3">
              {feedbackBanner}
              {appsBanner}
            </div>
          ) : null}
        </div>

        <div className="workspace-main-sheet min-h-0 min-w-0 flex-1 overflow-hidden rounded-[18px]">
          <div className="workspace-editor-surface h-full overflow-hidden rounded-[16px]">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto p-4 md:p-6"
            >
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
