import { CircleAlert, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ChatMessages } from "../ChatMessages";
import { Composer } from "../Composer";
import {
  formatNotebookAiChatError,
  type NotebookAiSessionValue,
} from "../NotebookAiSession";
import type { NotebookAiPanelProps } from "./types";
import type { PanelCommands } from "./usePanelCommands";
import type { PanelSurfaceState } from "./usePanelSurface";
import type { usePanelComposerSeed } from "./usePanelComposerSeed";
export function NotebookAiPanelBody({
  props,
  session,
  surface,
  commands,
  seed,
  isFullscreen,
  streamingMessageId,
}: {
  props: NotebookAiPanelProps;
  session: NotebookAiSessionValue;
  surface: PanelSurfaceState;
  commands: PanelCommands;
  seed: ReturnType<typeof usePanelComposerSeed>;
  isFullscreen: boolean;
  streamingMessageId?: string;
}) {
  const { notebookId, onClose, editorRef: _editorRef } = props;
  const { bodyReady, composerDockRef, composerRef } = surface;
  const {
    unavailableReason,
    messages,
    onBatchApproval,
    onBatchUndo,
    error,
    clearError,
    composerRevision,
    conversationId,
    isBusy,
    searchPages,
  } = session;
  const { initialReference, composerSeedContent } = seed;
  const { handleSend, handleSlashCommand, composerPlaceholder } = commands;
  return (
    <>
      <div className="notebook-ai-zoom-slot notebook-ai-content-surface">
        <div className="notebook-ai-zoom-surface">
          {!bodyReady ? null : unavailableReason ? (
            <div className="flex flex-1 items-center justify-center px-6 pb-[var(--ai-composer-float-pad,7.5rem)]">
              <div className="flex max-w-[260px] flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--goose-interactive-hover)] text-muted-foreground">
                  <CircleAlert className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  AI 暂不可用
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {unavailableReason}
                </p>
              </div>
            </div>
          ) : (
            <ChatMessages
              messages={messages}
              onEmptySuggestion={(text) => {
                const reference = initialReference
                  ? { ...initialReference, role: "target" as const }
                  : null;
                const tokens = reference
                  ? [
                      {
                        type: "reference" as const,
                        reference,
                        role: "target" as const,
                      },
                      { type: "text" as const, text: `\n${text}` },
                    ]
                  : [{ type: "text" as const, text }];
                void handleSend(
                  {
                    promptText: text,
                    freeformText: text,
                    references: reference ? [reference] : [],
                    images: [],
                    skills: [],
                    tokens,
                  },
                  [],
                );
              }}
              streamingMessageId={streamingMessageId}
              editorRef={_editorRef}
              layout={isFullscreen ? "fullscreen" : "side-panel"}
              onBatchApproval={onBatchApproval}
              onBatchUndo={onBatchUndo}
            />
          )}
        </div>
      </div>

      <div ref={composerDockRef} className="notebook-ai-composer-dock">
        {bodyReady && error ? (
          <div
            className={cn(
              "pointer-events-auto mb-2 w-full",
              isFullscreen ? "px-6" : "px-0",
            )}
          >
            <div
              className={cn(
                "flex items-start gap-2 rounded-[10px] border border-[var(--goose-color-danger-focus)] bg-[var(--goose-color-danger-subtle-bg)] px-3 py-2.5 text-xs",
                isFullscreen && "mx-auto max-w-[720px]",
              )}
              role="alert"
            >
              <CircleAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--goose-color-danger-focus)]"
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[var(--goose-color-danger-focus)]">
                  本轮失败原因
                </div>
                <div className="mt-0.5 break-words leading-relaxed text-foreground">
                  {formatNotebookAiChatError(error)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => clearError()}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[var(--goose-color-danger-focus)] outline-none transition-colors hover:bg-[var(--goose-color-danger-subtle-bg)]"
                aria-label="关闭错误提示"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : null}

        {bodyReady ? (
          <Composer
            ref={composerRef}
            key={`${notebookId}-${composerRevision}`}
            notebookId={notebookId}
            conversationId={conversationId}
            initialContent={composerSeedContent}
            onSend={handleSend}
            onSlashCommand={handleSlashCommand}
            isStreaming={isBusy}
            disabled={!!unavailableReason}
            placeholder={composerPlaceholder}
            searchPages={searchPages}
            onEscape={onClose}
            layout={isFullscreen ? "fullscreen" : "side-panel"}
          />
        ) : (
          <div className="h-[4.75rem]" aria-hidden />
        )}
      </div>
    </>
  );
}
