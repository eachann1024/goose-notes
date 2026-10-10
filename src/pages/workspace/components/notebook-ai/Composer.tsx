/** Notebook AI 输入条：草稿、附件、布局与原生引用动作各自维护。 */
import { forwardRef, useCallback } from "react";
import { ArrowUp, Plus } from "@/components/ui/icons";
import { ComposerPrimitive } from "@assistant-ui/react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { LoadingState } from "./beautiful-ui/LoadingState";
import { PromptBar } from "./beautiful-ui/PromptBar";
import { AiComposerInput } from "@/components/editor/ai/composer/AiComposerInput";
import { ModelSelectorPopover } from "./ModelSelectorPopover";
import { useComposerSurface } from "./composer/useComposerSurface";
import { useComposerDraft } from "./composer/useComposerDraft";
import { useComposerSubmission } from "./composer/useComposerSubmission";
import { useComposerAttachments } from "./composer/useComposerAttachments";
import { useComposerSelectionHandle } from "./composer/useComposerSelectionHandle";
import type { ComposerHandle, ComposerProps } from "./composer/types";
export type {
  NotebookAiImageAttachment,
  ComposerHandle,
} from "./composer/types";
const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer({ ...props }, ref) {
    const {
      notebookId,
      onSlashCommand,
      isStreaming,
      disabled,
      placeholder = "向 AI 提问，/ 调用指令或 Skill，@ 引用笔记或本地文件…",
      searchPages,
      onEscape,
      layout = "side-panel",
    } = props;
    const isFullscreen = layout === "fullscreen";
    const surface = useComposerSurface(props);
    const {
      inputRef,
      fileInputRef,
      autoFocusToken,
      seedContent,
      isEmpty,
      setIsEmpty,
      multiline,
      setMultiline,
      expanded,
      shellRef,
      plusWrapRef,
      modelWrapRef,
      sendWrapRef,
      recomputeExpanded,
    } = surface;
    const { cancelPendingDraftPersist, handleContentChange } =
      useComposerDraft(notebookId);
    const handleEscape = useCallback(() => {
      onEscape?.();
    }, [onEscape]);
    const handleSubmit = useComposerSubmission(
      props,
      surface,
      cancelPendingDraftPersist,
    );
    const {
      dropActive,
      handleImageInput,
      handleDockPaste,
      handleDockDragOver,
      handleDockDragLeave,
      handleDockDrop,
    } = useComposerAttachments(props, surface);
    useComposerSelectionHandle(props, surface, ref);
    // isEmpty 在 IME 会话里会滞后；发送按钮不因 isEmpty 禁用，避免「有字点不了」
    // 真正空内容由 handleSubmit 读 DOM 拦截。
    const canClickSend = !isStreaming && !disabled;
    const sendLooksReady = canClickSend && !isEmpty;

    return (
      <ComposerPrimitive.Root
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className={cn(
          "pointer-events-none",
          isFullscreen ? "px-6 pb-5" : "px-0 pb-2",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto w-full",
            isFullscreen ? "max-w-[720px]" : "max-w-none",
          )}
        >
          <PromptBar
            streaming={isStreaming}
            expanded={expanded}
            className={cn(
              "rounded-control",
              "shadow-[0_8px_22px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.32)]",
            )}
          >
            <div
              ref={shellRef}
              className={cn(
                "notebook-ai-composer-shell bui-root flex min-h-[44px] gap-2 overflow-hidden rounded-control",
                expanded ? "flex-wrap items-end" : "flex-nowrap items-center",
                "bg-[hsl(var(--goose-editor-bg))] py-1.5 pl-2.5 pr-2",
                dropActive &&
                  "ring-2 ring-[var(--goose-interactive-selected)] ring-offset-1 ring-offset-background",
              )}
              data-expanded={expanded ? "true" : undefined}
              data-multiline={multiline ? "true" : "false"}
              data-drop-active={dropActive ? "true" : undefined}
              onPaste={handleDockPaste}
              onDragEnter={handleDockDragOver}
              onDragOver={handleDockDragOver}
              onDragLeave={handleDockDragLeave}
              onDrop={handleDockDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={handleImageInput}
                disabled={disabled || isStreaming}
              />
              <span ref={plusWrapRef} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isStreaming}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                    "text-muted-foreground transition-colors duration-150",
                    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                    "",
                    "disabled:cursor-not-allowed disabled:text-disabled",
                    isStreaming && "invisible pointer-events-none",
                  )}
                  aria-hidden={isStreaming}
                  tabIndex={isStreaming ? -1 : undefined}
                  aria-label="上传图片"
                  title="上传图片"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </span>

              {/* 始终挂在同一父级，只切 order/basis，不条件换位置（会丢 contenteditable 节点） */}
              <AiComposerInput
                ref={inputRef}
                placeholder={placeholder}
                autoFocusToken={autoFocusToken}
                initialContent={seedContent}
                onContentChange={handleContentChange}
                onSubmit={handleSubmit}
                onEscape={handleEscape}
                onIsEmptyChange={(empty) => {
                  setIsEmpty(empty);
                  if (empty) recomputeExpanded();
                }}
                onMultilineChange={setMultiline}
                onLayoutMeasure={recomputeExpanded}
                className={
                  expanded ? "order-first w-full basis-full" : "flex-1"
                }
                searchPages={searchPages}
                referencePlacement="inline"
                variant="panel"
                notebookId={notebookId}
                disabled={disabled || isStreaming}
                maxImageBytes={MAX_IMAGE_FILE_BYTES}
                maxImageCount={MAX_IMAGE_ATTACHMENTS}
                onImageRejected={(message) => toast.error(message)}
                onSlashCommand={onSlashCommand}
              />

              <span ref={modelWrapRef} className="flex shrink-0 items-center">
                <ModelSelectorPopover disabled={disabled} />
              </span>

              {/* 仅 spacer：两行时把发送按钮顶到最右，不是输入 */}
              {expanded ? <div className="min-w-0 flex-1" aria-hidden /> : null}

              <span ref={sendWrapRef} className="flex shrink-0 items-center">
                {isStreaming ? (
                  <ComposerPrimitive.Cancel
                    className="bui-composer-send flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--goose-color-danger-subtle-bg)] text-[var(--goose-color-danger)] "
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <LoadingState
                      variant="Dots"
                      compact
                      label=""
                      showElapsed={false}
                    />
                  </ComposerPrimitive.Cancel>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canClickSend}
                    className={cn(
                      "bui-composer-send flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                      !sendLooksReady && "cursor-not-allowed text-disabled",
                    )}
                    aria-label="发送消息"
                    title="发送消息"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                )}
              </span>
            </div>
          </PromptBar>
        </div>
      </ComposerPrimitive.Root>
    );
  },
);

Composer.displayName = "Composer";
