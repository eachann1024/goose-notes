/** 消息列表：线程布局与时间分隔，渲染职责在 messages/。 */
import { useMemo, useState } from "react";
import { ArrowDown } from "@/components/ui/icons";
import { ThreadPrimitive } from "@assistant-ui/react";
import {
  formatChatMessageTime,
  shouldShowChatTimeDivider,
} from "@/lib/notebook-ai/messageTime";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";
import type { PreviewContent } from "@/lib/preview/previewAction";
import { cn } from "@/lib/utils";
import { AssistantUiThreadViewport } from "./AssistantUiThreadViewport";
import { ChatChrome } from "./beautiful-ui/ChatChrome";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { ChatMessagesProps } from "./messages/types";
import { UserMessage } from "./messages/UserMessage";
import { AssistantMessage } from "./messages/AssistantMessage";
export { buildUserMessageSegments } from "@/lib/notebook-ai/userMessageSegments";
export {
  ASSISTANT_TEXT_PARTS,
  ASSISTANT_APPROVAL_PARTS,
  ASSISTANT_ARTIFACT_PARTS,
} from "./messages/assistantParts";

export function ChatMessages({
  messages,
  streamingMessageId,
  editorRef,
  layout = "side-panel",
  onEmptySuggestion,
  onBatchApproval,
  onBatchUndo,
}: ChatMessagesProps) {
  const isFullscreen = layout === "fullscreen";
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(
    null,
  );
  // 只在被引用页面的标题变化时重绘历史消息，正文仍按发送时的快照拆分。
  usePages((state) =>
    messages
      .flatMap((message) => message.metadata?.references ?? [])
      .map((reference) => {
        const page = state.pages[reference.pageId];
        return page ? getPageTitle(page) : reference.titleSnapshot;
      })
      .join("\u0000"),
  );
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  /** messageId → 格式化时间文案；无则不展示分隔条 */
  const showTimeById = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const previous = i > 0 ? messages[i - 1] : null;
      if (!shouldShowChatTimeDivider(current, previous)) continue;
      const at = current.metadata?.createdAt;
      if (typeof at !== "number") continue;
      const label = formatChatMessageTime(at);
      if (label) map.set(current.id, label);
    }
    return map;
  }, [messages]);

  const toolRenderBase = useMemo(
    () => ({
      editorRef,
      onBatchApproval,
      onBatchUndo,
    }),
    [editorRef, onBatchApproval, onBatchUndo],
  );

  return (
    <ChatChrome className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <AssistantUiThreadViewport
        className={cn(
          // min-w-0：flex 子项可收缩；横向溢出由消息内表格滚动，这里只负责纵向
          "notebook-ai-messages min-w-0 flex-1 overflow-x-hidden overflow-y-scroll [scrollbar-width:thin]",
          messages.length === 0
            ? cn(
                "flex items-start justify-center pb-[var(--ai-composer-float-pad,7.5rem)]",
                isFullscreen ? "px-6 pt-5" : "p-0",
              )
            : undefined,
          messages.length > 0
            ? isFullscreen
              ? "px-6 pt-5"
              : "px-3 pt-3"
            : undefined,
        )}
      >
        {messages.length === 0 ? (
          <div
            className={cn(
              "notebook-ai-empty-state w-full min-w-0",
              isFullscreen && "notebook-ai-empty-state-fullscreen",
            )}
          >
            <h2 className="notebook-ai-empty-title text-foreground">
              从这一页开始。
            </h2>
            <p className="notebook-ai-empty-description text-muted-foreground">
              选一段文字，或直接说说想怎么改。
            </p>
            <div className="notebook-ai-empty-suggestions flex flex-col">
              {["润色开头", "梳理结构"].map((text) => (
                <button
                  key={text}
                  type="button"
                  className="notebook-ai-empty-suggestion"
                  onClick={() => onEmptySuggestion?.(text)}
                  aria-label={`发送建议：${text}`}
                >
                  <span>{text}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto w-full min-w-0 max-w-full space-y-3",
              isFullscreen ? "max-w-[720px]" : "max-w-none",
            )}
          >
            <ThreadPrimitive.Messages>
              {({ message }) => {
                const sourceMessage = messageById.get(message.id);
                if (!sourceMessage) return null;
                const timeLabel = showTimeById.get(sourceMessage.id);
                const body =
                  sourceMessage.role === "user" ? (
                    <UserMessage
                      msg={sourceMessage}
                      setPreviewContent={setPreviewContent}
                    />
                  ) : (
                    <AssistantMessage
                      msg={sourceMessage}
                      isStreaming={streamingMessageId === sourceMessage.id}
                      toolRenderBase={toolRenderBase}
                    />
                  );
                return (
                  <>
                    {timeLabel ? (
                      <div
                        className="notebook-ai-message-time"
                        role="separator"
                        aria-label={timeLabel}
                      >
                        {timeLabel}
                      </div>
                    ) : null}
                    {body}
                  </>
                );
              }}
            </ThreadPrimitive.Messages>
            <ThreadPrimitive.ViewportFooter className="pointer-events-none sticky bottom-[calc(var(--ai-composer-float-pad,7.5rem)+12px)] z-10 flex h-0 justify-center overflow-visible">
              <ThreadPrimitive.ScrollToBottom
                className="pointer-events-auto flex h-8 w-8 -translate-y-10 items-center justify-center rounded-control border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:hidden"
                aria-label="滚动到底部"
                title="滚动到底部"
              >
                <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
              </ThreadPrimitive.ScrollToBottom>
            </ThreadPrimitive.ViewportFooter>
            <div
              className="pointer-events-none h-[var(--ai-composer-float-pad,7.5rem)] shrink-0"
              aria-hidden
            />
          </div>
        )}
      </AssistantUiThreadViewport>
      <FullscreenPreview
        open={Boolean(previewContent)}
        content={previewContent}
        title={previewContent?.fileName}
        onClose={() => setPreviewContent(null)}
      />
    </ChatChrome>
  );
}
