/**
 * Electron 桌面端全宽底部状态栏（与 DesktopTitleBar 对位）。
 * 挂在 .workspace-shell 底部、覆盖侧栏+主区全宽；Win 原生框下尤其需要这条自定义底栏。
 */
import { useMemo } from "react";
import type { Page } from "@/types";
import { useNotebooks } from "@/stores/useNotebooks";
import { cn } from "@/lib/utils";

export interface DesktopStatusBarProps {
  page?: Page;
  isWelcomeTab?: boolean;
}

export function DesktopStatusBar({
  page,
  isWelcomeTab = false,
}: DesktopStatusBarProps) {
  const notebooks = useNotebooks((s) => s.notebooks);
  const activeNotebookId = useNotebooks((s) => s.activeNotebookId);

  const notebook = useMemo(() => {
    const id = page?.workspaceId ?? activeNotebookId;
    return id ? notebooks[id] : undefined;
  }, [page?.workspaceId, activeNotebookId, notebooks]);

  const notebookLabel = notebook?.name?.trim() || "记事本";
  const pageLabel = isWelcomeTab
    ? "欢迎页"
    : page?.trashedAt
      ? "回收站"
      : page?.title?.trim() || (page ? "未命名页面" : "");
  const sourceLabel =
    notebook?.source === "local-folder" ? "本地文件夹" : "本地库";

  return (
    <footer
      className={cn(
        "electron-statusbar flex w-full shrink-0 items-center gap-3 border-t border-border/50 px-3",
        "bg-[var(--workspace-sidebar-surface)] text-[11px] text-muted-foreground",
        "select-none",
      )}
      data-electron-no-drag
      role="status"
      aria-label="窗口状态栏"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <span className="truncate font-medium text-foreground/80">
          {notebookLabel}
        </span>
        {pageLabel ? (
          <>
            <span className="shrink-0 text-muted-foreground/50" aria-hidden>
              /
            </span>
            <span className="truncate">{pageLabel}</span>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tabular-nums text-muted-foreground/80">
          {sourceLabel}
        </span>
      </div>
    </footer>
  );
}
