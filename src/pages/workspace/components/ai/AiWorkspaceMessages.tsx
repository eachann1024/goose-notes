import type { RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import type { MarkdownNoteArtifact } from "@/agent/core/types";
import {
  AgentArtifactView,
  StreamingDatavizText,
  artifactHasDataviz,
  textHasDataviz,
} from "@/agent/renderers/AgentArtifactView";
import { getPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import type { AiFileReferenceAttrs } from "../editor/ai-composer/referenceLookup";
import {
  STREAM_PHASE_LABEL,
  type AiConversationMessage,
} from "./useAiSessionHistory";
import { AssistantMessageActions } from "./AssistantMessageActions";

const AI_WORKSPACE_DEFAULT_DIAGRAM_URL =
  "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/AI%20default%20diagram.png";

function MessageReferenceChip({ reference }: { reference: AiFileReferenceAttrs }) {
  const page = usePages((state) => state.getPage(reference.pageId));
  const { openTab } = useTabs();
  const title = page ? getPageTitle(page) : reference.titleSnapshot;
  const icon = page?.icon;
  const isAvailable = !!page && !page.trashedAt;

  const handleOpen = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (!isAvailable) return;
    event.stopPropagation();
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    openTab(reference.pageId);
  };

  return (
    <span
      role={isAvailable ? "button" : undefined}
      tabIndex={isAvailable ? 0 : undefined}
      onClick={isAvailable ? handleOpen : undefined}
      onKeyDown={isAvailable ? handleOpen : undefined}
      className={cn(
        "ai-message-ref inline-flex items-center gap-1 align-baseline rounded-md px-1.5 py-[1px] text-[12.5px] leading-snug mx-[1px]",
        "bg-background/70 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]",
        isAvailable &&
          "cursor-pointer transition-colors hover:bg-background hover:shadow-[inset_0_0_0_1px_hsl(var(--border))]",
        !isAvailable && "italic text-muted-foreground/85",
      )}
    >
      {icon ? (
        <span className="text-[12px] leading-none">{icon}</span>
      ) : (
        <LucideIcons.FileText className="h-3 w-3 shrink-0 text-muted-foreground/80" />
      )}
      <span className="max-w-[200px] truncate">{title}</span>
    </span>
  );
}

function renderMessageWithReferences(
  text: string,
  references: AiFileReferenceAttrs[] | undefined,
): React.ReactNode {
  if (!text) return null;
  if (!references || references.length === 0) return text;

  const sorted = [...references].sort(
    (a, b) => b.titleSnapshot.length - a.titleSnapshot.length,
  );

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    let best: { idx: number; ref: AiFileReferenceAttrs; len: number } | null = null;
    for (const ref of sorted) {
      if (!ref.titleSnapshot) continue;
      const needle = `@${ref.titleSnapshot}`;
      const idx = text.indexOf(needle, cursor);
      if (idx !== -1 && (best === null || idx < best.idx)) {
        best = { idx, ref, len: needle.length };
      }
    }

    if (!best) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(cursor)}</span>);
      break;
    }

    if (best.idx > cursor) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(cursor, best.idx)}</span>);
    }
    nodes.push(
      <MessageReferenceChip key={`r-${key++}-${best.ref.pageId}`} reference={best.ref} />,
    );
    cursor = best.idx + best.len;
  }

  return nodes;
}

interface AiWorkspaceMessagesProps {
  messages: AiConversationMessage[];
  isStreaming: boolean;
  streamPhase: keyof typeof STREAM_PHASE_LABEL;
  applyingMessageId: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onRegenerate: (messageIndex: number) => void;
  onSwitchVersion: (messageId: string, versionIndex: number) => void;
  onConfirmWrite: (messageId: string, artifact: MarkdownNoteArtifact) => void;
  onCancelWrite: (messageId: string, artifact: MarkdownNoteArtifact) => void;
  onOpenResultPage: (pageId: string) => void;
}

export function AiWorkspaceMessages({
  messages,
  isStreaming,
  streamPhase,
  applyingMessageId,
  messagesEndRef,
  onRegenerate,
  onSwitchVersion,
  onConfirmWrite,
  onCancelWrite,
  onOpenResultPage,
}: AiWorkspaceMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-[calc(100vh-180px)] flex-col justify-center px-4 pb-10">
        <div
          data-ai-empty-state-card="true"
          className="relative overflow-hidden rounded-[30px] border border-border/70 bg-muted/60 dark:bg-[#1c2027] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-90"
            style={{
              backgroundImage: `url("${AI_WORKSPACE_DEFAULT_DIAGRAM_URL}")`,
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,16,24,0.14)_0%,rgba(12,16,24,0.35)_48%,rgba(12,16,24,0.6)_100%)] dark:bg-[linear-gradient(180deg,rgba(12,16,24,0.14)_0%,rgba(12,16,24,0.5)_48%,rgba(12,16,24,0.82)_100%)]" />
          <div className="relative flex min-h-[220px] flex-col justify-end px-6 py-7 sm:min-h-[248px] sm:px-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 backdrop-blur-[6px]">
              <AiGradientIcon className="h-5 w-5" />
            </div>
            <div className="text-base font-medium text-white">
              在底部输入框直接提问
            </div>
            <div className="mt-2 max-w-xl text-sm leading-6 text-white dark:text-white/72">
              可以直接发起独立聊天，也可以通过 @ 引用应用页面或本地文件。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20">
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;

        const isDataviz =
          message.role === "assistant" &&
          !message.error &&
          (artifactHasDataviz(message.artifact) || textHasDataviz(message.text));

        const isUserMsg = message.role === "user";

        if (isDataviz) {
          return (
            <div key={message.id} className="flex flex-col gap-1.5 px-4 py-2">
              <div className="select-text w-full text-foreground">
                {message.artifact ? (
                  <AgentArtifactView
                    artifact={message.artifact}
                    applying={applyingMessageId === message.id}
                    onConfirmMarkdownNote={(artifact) => {
                      onConfirmWrite(message.id, artifact);
                    }}
                    onCancelMarkdownNote={(artifact) => {
                      onCancelWrite(message.id, artifact);
                    }}
                    onOpenResult={onOpenResultPage}
                  />
                ) : (
                  <StreamingDatavizText
                    text={message.text}
                    streaming={!!message.streaming}
                    streamPhaseLabel={STREAM_PHASE_LABEL[streamPhase]}
                  />
                )}
              </div>
              {!message.streaming && !message.error && (
                <AssistantMessageActions
                  message={message}
                  messageIndex={index}
                  isStreaming={isStreaming}
                  onRegenerate={onRegenerate}
                  onSwitchVersion={onSwitchVersion}
                />
              )}
            </div>
          );
        }

        if (isUserMsg) {
          return (
            <div key={message.id} className="flex flex-col items-end px-4 py-2">
              <div
                className={cn(
                  "ai-message-user select-text max-w-[88%]",
                  "rounded-[14px] px-3.5 py-2.5",
                  "bg-[hsl(var(--goose-selected-bg))] text-foreground",
                  "shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]",
                )}
              >
                <div className="whitespace-pre-wrap break-words text-sm leading-[1.55]">
                  {renderMessageWithReferences(message.text, message.references)}
                </div>
              </div>
            </div>
          );
        }

        // assistant message (non-dataviz)
        return (
          <div key={message.id} className="flex gap-2.5 px-4 py-2">
            <div
              className={cn(
                "shrink-0 pt-[3px]",
                message.error && "text-destructive",
              )}
            >
              {message.error ? (
                <LucideIcons.AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <AiGradientIcon className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1 select-text">
              {message.error ? (
                <div className="text-sm leading-6 text-destructive whitespace-pre-wrap break-words">
                  {message.text || "请求失败，请重试"}
                </div>
              ) : message.artifact ? (
                <AgentArtifactView
                  artifact={message.artifact}
                  applying={applyingMessageId === message.id}
                  onConfirmMarkdownNote={(artifact) => {
                    onConfirmWrite(message.id, artifact);
                  }}
                  onCancelMarkdownNote={(artifact) => {
                    onCancelWrite(message.id, artifact);
                  }}
                  onOpenResult={onOpenResultPage}
                />
              ) : message.text ? (
                <StreamingDatavizText
                  text={message.text}
                  streaming={!!message.streaming}
                  streamPhaseLabel={STREAM_PHASE_LABEL[streamPhase]}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm leading-6 text-muted-foreground/85">
                  {message.streaming ? (
                    <>
                      <span className="inline-block h-[7px] w-[7px] rounded-full bg-foreground/45 animate-pulse" />
                      <span>{STREAM_PHASE_LABEL[streamPhase]}</span>
                    </>
                  ) : (
                    <span className="text-destructive">未收到响应，请重试</span>
                  )}
                </div>
              )}
              {!message.streaming && (
                <AssistantMessageActions
                  message={message}
                  messageIndex={index}
                  isStreaming={isStreaming}
                  onRegenerate={onRegenerate}
                  onSwitchVersion={onSwitchVersion}
                />
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
