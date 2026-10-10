import { type ComponentProps } from "react";
import { NotebookAiPanel } from "../../components/notebook-ai/NotebookAiPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function GuardedNotebookAiPanel(
  props: ComponentProps<typeof NotebookAiPanel>,
) {
  return (
    <ErrorBoundary
      resetKey={props.notebookId}
      fallback={(_, reset) => (
        <div className="flex min-h-[260px] min-w-[240px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
          <p>AI 面板渲染失败，已阻止整窗白屏。</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
          >
            重试
          </button>
        </div>
      )}
    >
      <NotebookAiPanel {...props} />
    </ErrorBoundary>
  );
}
