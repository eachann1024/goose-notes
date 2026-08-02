/**
 * 消息列表组件 — Streamdown 渲染 text part，自动吸底，用户上滚暂停
 */
import type { ComponentProps, RefObject } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  BranchPickerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { ToolProgressCard } from "./ToolProgressCard";
import {
  ApprovalPlanCard,
  type BatchApprovalResponse,
  type BatchUndoResult,
} from "./ApprovalPlanCard";
import { TableCard } from "./TableCard";
import { ChartCard } from "./ChartCard";
import { DiagramCard } from "./DiagramCard";
import { SvgArtifactCard } from "./SvgArtifactCard";
import {
  shouldShowToolProgress,
  type ToolDisplayPart,
} from "./toolProgressVisibility";
import type { EditorRef } from "@/components/editor/core/Editor";
import type { AiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";
import { isNotebookAiToolPart } from "@/lib/notebook-ai/messageUtils";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import { cn } from "@/lib/utils";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { AssistantUiThreadViewport } from "./AssistantUiThreadViewport";

const ANIMATE_OPTIONS = {
  animation: "blurIn" as const,
  duration: 250,
  sep: "word" as const,
};

/** 任务列表的原生 checkbox 替换为自绘勾选框（样式见 notebook-ai.css） */
function MdInput({
  node,
  ...props
}: ComponentProps<"input"> & { node?: unknown }) {
  void node;
  if (props.type === "checkbox") {
    return (
      <span
        className="ai-md-checkbox"
        data-checked={props.checked ? "true" : "false"}
      >
        {props.checked ? <Check strokeWidth={2.5} /> : null}
      </span>
    );
  }
  return <input {...props} />;
}

const MD_COMPONENTS = { input: MdInput };

interface ChatMessagesProps {
  messages: NotebookAiMessage[];
  /** 正在流式输出的消息 id（最后一条 assistant msg id）*/
  streamingMessageId?: string;
  editorRef?: RefObject<EditorRef | null>;
  /** 全屏会话更宽、居中；侧栏保持紧凑 */
  layout?: "side-panel" | "fullscreen";
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

const INPUT_ONLY_STATES = new Set([
  "call",
  "partial-call",
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
]);

function getTextPartText(message: NotebookAiMessage) {
  const textPart = message.parts?.find((p) => p.type === "text");
  return textPart && "text" in textPart
    ? (textPart as { text: string }).text
    : "";
}

function getUserDisplayText(message: NotebookAiMessage) {
  const metadataText = message.metadata?.displayText?.trim();
  if (metadataText) return metadataText;

  const rawText = getTextPartText(message).trim();
  const hiddenContextStart = rawText.indexOf("\n\n本轮笔记上下文：");
  if (rawText.startsWith("用户输入：") && hiddenContextStart > -1) {
    return rawText.slice("用户输入：".length, hiddenContextStart).trim();
  }
  if (rawText.startsWith("用户输入：")) {
    return rawText.slice("用户输入：".length).trim();
  }
  return rawText;
}

type UserMessageSegment =
  | { type: "text"; text: string }
  | { type: "reference"; reference: AiFileReferenceAttrs; key: string };

/**
 * 把 displayText 里的 `@标题` 拆成与输入框一致的内联 chip 片段。
 * 同位置优先匹配更长标题，避免短标题抢匹配。
 */
function buildUserMessageSegments(
  text: string,
  references: AiFileReferenceAttrs[],
): UserMessageSegment[] {
  if (!text) return [];
  if (references.length === 0) return [{ type: "text", text }];

  const needles = references
    .map((reference) => ({
      reference,
      needle: `@${reference.titleSnapshot}`,
    }))
    .filter((item) => item.needle.length > 1);

  if (needles.length === 0) return [{ type: "text", text }];

  const segments: UserMessageSegment[] = [];
  let cursor = 0;
  let refOccurrence = 0;

  while (cursor < text.length) {
    let match: {
      index: number;
      length: number;
      reference: AiFileReferenceAttrs;
    } | null = null;

    for (const { reference, needle } of needles) {
      const index = text.indexOf(needle, cursor);
      if (index === -1) continue;
      if (
        !match ||
        index < match.index ||
        (index === match.index && needle.length > match.length)
      ) {
        match = { index, length: needle.length, reference };
      }
    }

    if (!match) {
      segments.push({ type: "text", text: text.slice(cursor) });
      break;
    }

    if (match.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, match.index) });
    }

    segments.push({
      type: "reference",
      reference: match.reference,
      key: `${match.reference.pageId}-${refOccurrence++}`,
    });
    cursor = match.index + match.length;
  }

  return segments;
}

function getUserImageParts(message: NotebookAiMessage) {
  return (message.parts ?? []).filter(
    (
      part,
    ): part is {
      type: "file";
      url: string;
      filename?: string;
      mediaType: string;
    } =>
      part.type === "file" &&
      "url" in part &&
      typeof part.url === "string" &&
      "mediaType" in part &&
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/"),
  );
}

function shouldShowToolPart(
  part: ToolDisplayPart,
  isMessageStreaming: boolean,
) {
  const state = part.state ?? "";
  if (
    part.type === "tool-executeBatchPlan" &&
    (state === "approval-requested" || state === "approval-responded")
  ) {
    return true;
  }
  const hasTerminalPayload =
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    part.output !== undefined ||
    Boolean(part.errorText);

  return (
    isMessageStreaming || !INPUT_ONLY_STATES.has(state) || hasTerminalPayload
  );
}

function renderToolVisual(
  part: ToolDisplayPart,
  key: string | number,
  editorRef: RefObject<EditorRef | null> | undefined,
) {
  if (
    part.type === "tool-showTable" &&
    part.state === "output-available" &&
    part.output
  ) {
    const tableData = part.output as {
      title?: string;
      columns: string[];
      rows: string[][];
    };
    return (
      <TableCard
        key={key}
        title={tableData.title}
        columns={tableData.columns}
        rows={tableData.rows}
      />
    );
  }

  if (
    part.type === "tool-showChart" &&
    part.state === "output-available" &&
    part.output
  ) {
    const chartData = part.output as {
      type: "bar" | "line" | "pie";
      title?: string;
      categories?: string[];
      series: Array<{ name: string; data: number[] }>;
    };
    return (
      <ChartCard
        key={key}
        type={chartData.type}
        title={chartData.title}
        categories={chartData.categories}
        series={chartData.series}
      />
    );
  }

  if (
    part.type === "tool-showDiagram" &&
    part.state === "output-available" &&
    part.output
  ) {
    const diagramData = part.output as {
      title?: string;
      language: "mermaid";
      source: string;
    };
    return (
      <DiagramCard
        key={key}
        title={diagramData.title}
        source={diagramData.source}
        editorRef={editorRef}
      />
    );
  }

  if (
    part.type === "tool-showSvg" &&
    part.state === "output-available" &&
    part.output
  ) {
    const svgData = part.output as {
      title?: string;
      svg: string;
    };
    return (
      <SvgArtifactCard
        key={key}
        title={svgData.title}
        svg={svgData.svg}
        editorRef={editorRef}
      />
    );
  }

  return null;
}

export function ChatMessages({
  messages,
  streamingMessageId,
  editorRef,
  layout = "side-panel",
  onBatchApproval,
  onBatchUndo,
}: ChatMessagesProps) {
  const { onOpenPage } = useEditorPageContext();
  const isFullscreen = layout === "fullscreen";
  const messageById = new Map(messages.map((message) => [message.id, message]));

  const MessageActionBar = () => (
    <div className="mt-1 flex min-h-6 items-center gap-1">
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        autohideFloat="never"
        className="flex items-center gap-1"
      >
        <ActionBarPrimitive.Copy
          copiedDuration={1600}
          className="flex h-6 w-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground disabled:hidden"
          aria-label="复制消息"
          title="复制"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
        </ActionBarPrimitive.Copy>
      </ActionBarPrimitive.Root>
      <BranchPickerPrimitive.Root
        hideWhenSingleBranch
        className="flex items-center gap-0.5 text-[11px] text-muted-foreground"
      >
        <BranchPickerPrimitive.Previous
          className="flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-background/60 disabled:opacity-40"
          aria-label="上一个回答分支"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </BranchPickerPrimitive.Previous>
        <span>
          <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
        </span>
        <BranchPickerPrimitive.Next
          className="flex h-6 w-6 items-center justify-center rounded-[6px] hover:bg-background/60 disabled:opacity-40"
          aria-label="下一个回答分支"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </BranchPickerPrimitive.Next>
      </BranchPickerPrimitive.Root>
    </div>
  );

  const renderUserMessage = (msg: NotebookAiMessage) => {
    const text = getUserDisplayText(msg);
    const hasLiveImages = getUserImageParts(msg).length > 0;
    const persistedImages = msg.metadata?.imageAttachments ?? [];
    const references = msg.metadata?.references ?? [];
    const textSegments = buildUserMessageSegments(text, references);

    return (
      <MessagePrimitive.Root className="flex flex-col items-end">
        <div className="notebook-ai-message-text max-w-[85%] space-y-2 rounded-[14px] rounded-tr-[4px] bg-[#58d7b8]/12 px-3 py-2 text-sm text-foreground leading-relaxed">
          <MessagePrimitive.Attachments>
            {({ attachment }) => {
              const imagePart = attachment.content.find(
                (part) => part.type === "image",
              );
              return (
                <AttachmentPrimitive.Root className="inline-flex max-w-full flex-col gap-1">
                  {imagePart?.type === "image" ? (
                    <img
                      src={imagePart.image}
                      alt={attachment.name}
                      className="h-20 w-20 rounded-[8px] object-cover"
                    />
                  ) : null}
                  <span className="sr-only">
                    <AttachmentPrimitive.Name />
                  </span>
                </AttachmentPrimitive.Root>
              );
            }}
          </MessagePrimitive.Attachments>
          {!hasLiveImages && persistedImages.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {persistedImages.map((image) => (
                <span
                  key={`${image.filename}-${image.mediaType}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-background/45 px-1.5 py-1 text-[11px] text-muted-foreground"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                  <span className="max-w-[170px] truncate">
                    {image.filename}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          {textSegments.length > 0 ? (
            <div className="notebook-ai-message-inline select-text">
              {textSegments.map((segment, index) =>
                segment.type === "text" ? (
                  <span
                    key={`text-${index}`}
                    className="notebook-ai-message-inline-text"
                  >
                    {segment.text}
                  </span>
                ) : (
                  <button
                    key={segment.key}
                    type="button"
                    onClick={() => onOpenPage(segment.reference.pageId)}
                    className={cn(
                      "ai-composer-chip inline-flex max-w-full min-w-0 items-center truncate rounded px-1.5 text-[11px] font-medium leading-none outline-none",
                      "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]",
                      "hover:bg-[var(--goose-interactive-hover)] focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    title={`打开“${segment.reference.titleSnapshot}”`}
                    aria-label={`打开引用文件：${segment.reference.titleSnapshot}`}
                  >
                    @{segment.reference.titleSnapshot}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
        <MessageActionBar />
      </MessagePrimitive.Root>
    );
  };

  const renderAssistantMessage = (
    msg: NotebookAiMessage,
    isStreaming: boolean,
  ) => {
    const progressToolParts = (msg.parts ?? [])
      .filter(isNotebookAiToolPart)
      .filter((part) => shouldShowToolPart(part, isStreaming));
    const showToolProgress = shouldShowToolProgress(
      progressToolParts,
      isStreaming,
    );

    const TextPart = ({ text }: TextMessagePartProps) => (
      <div className="ai-md notebook-ai-message-text select-text text-sm text-foreground">
        <Streamdown
          className="space-y-2"
          components={MD_COMPONENTS}
          isAnimating={isStreaming}
          animated={ANIMATE_OPTIONS}
          plugins={{ cjk }}
          parseIncompleteMarkdown={isStreaming}
        >
          {text}
        </Streamdown>
      </div>
    );

    const ToolPart = ({ artifact }: ToolCallMessagePartProps) => {
      const part = artifact as ToolDisplayPart | undefined;
      if (!part || !shouldShowToolPart(part, isStreaming)) return null;
      if (part.type === "tool-executeBatchPlan") {
        if (
          part.state === "input-streaming" ||
          part.state === "input-available" ||
          part.state === "call" ||
          part.state === "partial-call"
        ) {
          return null;
        }
        return (
          <ApprovalPlanCard
            part={part}
            onApprovalResponse={onBatchApproval}
            onUndo={onBatchUndo}
          />
        );
      }
      return renderToolVisual(part, part.toolCallId ?? part.type, editorRef);
    };

    return (
      <MessagePrimitive.Root className="space-y-2 rounded-[14px] bg-[var(--goose-interactive-hover)]/70 px-3.5 py-3">
        <div className="flex select-none items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[6px] bg-[#58d7b8]/15 text-[#58d7b8]">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.25} />
          </span>
          <span>回答</span>
        </div>
        {showToolProgress ? (
          <ToolProgressCard
            parts={progressToolParts}
            isMessageStreaming={isStreaming}
          />
        ) : null}
        <MessagePrimitive.Parts
          components={{
            Text: TextPart,
            Reasoning: () => null,
            tools: { Override: ToolPart },
          }}
        />
        <MessagePrimitive.Error>
          <p className="text-xs text-destructive">这条回复生成失败。</p>
        </MessagePrimitive.Error>
        <MessageActionBar />
      </MessagePrimitive.Root>
    );
  };

  return (
    <AssistantUiThreadViewport
      className={cn(
        "notebook-ai-messages flex-1 overflow-y-auto [scrollbar-width:thin]",
        messages.length === 0 ? "flex items-center justify-center" : undefined,
        isFullscreen ? "px-6 py-5" : "px-3 py-3",
      )}
    >
      {messages.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center gap-3 text-center",
            isFullscreen ? "max-w-[360px]" : "max-w-[260px]",
          )}
        >
          <div
            className={cn(
              "relative flex items-center justify-center rounded-[12px] bg-[var(--goose-interactive-hover)] text-muted-foreground",
              isFullscreen ? "h-12 w-12" : "h-11 w-11",
            )}
          >
            <MessageSquareText
              className={isFullscreen ? "h-6 w-6" : "h-5 w-5"}
              strokeWidth={1.75}
            />
            <Sparkles
              className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground"
              strokeWidth={1.75}
            />
          </div>
          <p
            className={cn(
              "font-medium text-foreground",
              isFullscreen ? "text-[15px]" : "text-sm",
            )}
          >
            开始和 AI 对话
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isFullscreen
              ? "全屏会话模式：整理、搜索、创作笔记，随时可切回侧栏并排。"
              : "让它帮你整理、搜索、创作笔记。"}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto w-full space-y-3",
            isFullscreen ? "max-w-[720px]" : "max-w-none",
          )}
        >
          <ThreadPrimitive.Messages>
            {({ message }) => {
              const sourceMessage = messageById.get(message.id);
              if (!sourceMessage) return null;
              return sourceMessage.role === "user"
                ? renderUserMessage(sourceMessage)
                : renderAssistantMessage(
                    sourceMessage,
                    streamingMessageId === sourceMessage.id,
                  );
            }}
          </ThreadPrimitive.Messages>
          <ThreadPrimitive.ViewportFooter className="sticky bottom-2 flex justify-center">
            <ThreadPrimitive.ScrollToBottom
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:hidden"
              aria-label="滚动到底部"
              title="滚动到底部"
            >
              <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.ViewportFooter>
        </div>
      )}
    </AssistantUiThreadViewport>
  );
}
