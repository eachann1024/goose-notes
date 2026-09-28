import * as LucideIcons from "lucide-react";
import { useEffect, useState } from "react";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { checkAppUpdate } from "@/lib/electron/appUpdate";
import { cn } from "@/lib/utils";
import { NotebookSwitcher } from "./NotebookSwitcher";

export interface SidebarFooterProps {
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
}

export function SidebarFooter({
  isSettingsOpen,
  onOpenSettings,
}: SidebarFooterProps) {
  const [readyVersion, setReadyVersion] = useState("");
  const [availableVersion, setAvailableVersion] = useState("");
  useEffect(() => {
    const desktop = getGooseDesktop();
    if (!desktop) return;
    const unsubscribe = desktop.onUpdateReady(setReadyVersion);
    void desktop.getReadyUpdate().then(setReadyVersion).catch(() => {});
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!getGooseDesktop()) return;
    let active = true;
    const check = async () => {
      try {
        const result = await checkAppUpdate();
        if (active) setAvailableVersion(result?.status === "available" ? result.latestVersion : "");
      } catch { /* Network errors stay silent; manual check in About shows details. */ }
    };
    void check();
    const timer = window.setInterval(() => void check(), 4 * 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const btnClass =
    "sidebar-footer-control inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground transition-[background-color,color,box-shadow,transform] hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] active:translate-y-px active:bg-[var(--goose-interactive-selected)] active:text-[var(--goose-interactive-selected-fg)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--goose-interactive-selected-fg)] [&_svg]:block";
  const activeClass =
    "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]";

  return (
    <TooltipProvider delayDuration={600}>
      <div className="sidebar-rail-footer">
        {readyVersion ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(btnClass, activeClass)}
                aria-label={`更新 ${readyVersion} 已下载，点击重启安装`}
                title={`更新 ${readyVersion} 已下载，点击重启安装`}
                onClick={() => void getGooseDesktop()?.installReadyUpdate()}
              >
                <LucideIcons.RotateCw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              更新 {readyVersion} 已下载，点击重启安装
            </TooltipContent>
          </Tooltip>
        ) : availableVersion ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(btnClass, activeClass)}
                aria-label={`发现新版本 ${availableVersion}，打开更新说明`}
                title={`发现新版本 ${availableVersion}，打开更新说明`}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("goose-note:settings-tab-change", {
                      detail: { tab: "about" },
                    }),
                  );
                  onOpenSettings();
                }}
              >
                <LucideIcons.Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              发现新版本 {availableVersion}，打开更新说明
            </TooltipContent>
          </Tooltip>
        ) : null}
        <NotebookSwitcher variant="rail" onOpenSettings={onOpenSettings} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(btnClass, isSettingsOpen && activeClass)}
              aria-label="设置"
              title="设置"
              aria-pressed={isSettingsOpen}
              onClick={onOpenSettings}
            >
              <LucideIcons.Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
