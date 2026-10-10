import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useHistoryViewLogic } from "./useHistoryViewLogic";

export function HistoryToolbar() {
  const {
    pageTitle,
    isEmpty,
    selectedVersionId,
    selectedStatus,
    isRestoring,
    exit,
    handleRestore,
  } = useHistoryViewLogic();

  return (
    <header className="h-11 px-3 flex items-center gap-3 shrink-0 bg-[hsl(var(--goose-editor-bg))]">
      <Button
        variant="secondary"
        size="sm"
        aria-label="返回编辑页面"
        className="history-secondary-control h-8 px-3 text-xs gap-1.5 text-foreground shadow-none transition-[background-color,color,transform] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] active:translate-y-px active:bg-[var(--goose-interactive-selected)] active:text-[var(--goose-interactive-selected-fg)]"
        onClick={exit}
      >
        <GooseIcons.ArrowLeft className="h-3.5 w-3.5" />
        返回
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{pageTitle}</span>
      </div>

      {!isEmpty && (
        <Button
          size="sm"
          aria-label={
            isRestoring
              ? "正在还原此版本"
              : selectedStatus === "loading"
                ? "正在读取历史版本"
                : "还原此版本"
          }
          aria-busy={isRestoring || selectedStatus === "loading" || undefined}
          className="history-primary-control h-7 shrink-0 px-3 text-xs transition-[background-color,box-shadow,transform] hover:bg-[var(--goose-primary-hover-bg)] active:translate-y-px active:bg-[var(--goose-primary-active-bg)] active:shadow-none"
          disabled={
            !selectedVersionId || selectedStatus !== "ready" || isRestoring
          }
          onClick={handleRestore}
        >
          {isRestoring || selectedStatus === "loading" ? (
            <>
              <GooseIcons.LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              {isRestoring ? "正在还原" : "正在读取"}
            </>
          ) : (
            "还原此版本"
          )}
        </Button>
      )}
    </header>
  );
}
