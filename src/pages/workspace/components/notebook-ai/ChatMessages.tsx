/**
 * 消息列表组件 — Streamdown 渲染 text part，自动吸底，用户上滚暂停
 */
import {
  createContext,
  memo,
  useContext,
  useMemo,
  type ComponentProps,
  type RefObject,
} from "react";
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
import { isNotebookAiToolPart } from "@/lib/notebook-ai/messageUtils";
import {
  formatChatMessageTime,
  shouldShowChatTimeDivider,
} from "@/lib/notebook-ai/messageTime";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import { buildUserMessageSegments } from "@/lib/notebook-ai/userMessageSegments";
import { cn } from "@/lib/utils";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { AssistantUiThreadViewport } from "./AssistantUiThreadViewport";
import {
  GooseAiBorderBeam,
  GooseThinkingOrb,
  THINKING_PLACEHOLDER_MIN_MS,
  useMinHoldActive,
} from "@/components/ui/ai-motion";

/** 供测试/外部复用；实现见 userMessageSegments */
export { buildUserMessageSegments } from "@/lib/notebook-ai/userMessageSegments";

/**
 * 不用 Streamdown 的 word blurIn：流结束时 isAnimating 翻转会拆掉 animate rehype 插件，
 * 整段 Markdown 重解析，长中文消息可卡主线程约 1s，连带输入框 BorderBeam 掉帧。
 * 流式增量本身已有「正在写出」感，足够。
 */

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

/** 模块级稳定引用：禁止 plugins={{ cjk }} 内联，避免 Streamdown 每帧当新插件树 */
const STREAMDOWN_PLUGINS = { cjk };

/**
 * 助手正文：模块级 memo，禁止在 renderAssistantMessage 内定义 TextPart，
 * 否则每次父渲染新组件 identity → 卸载/重挂 Streamdown → 流式极卡。
 */
const AssistantStreamdownText = memo(function AssistantStreamdownText({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  if (!text?.trim()) return null;
  return (
    <div className="ai-md notebook-ai-message-text select-text text-sm text-foreground">
      <Streamdown
        className="space-y-2"
        mode={isStreaming ? "streaming" : "static"}
        components={MD_COMPONENTS}
        plugins={STREAMDOWN_PLUGINS}
        parseIncompleteMarkdown={isStreaming}
      >
        {text}
      </Streamdown>
    </div>
  );
});

function EmptyReasoningPart() {
  return null;
}

/** 工具 / 正文 part 共享的每消息上下文（组件函数本身保持模块级稳定） */
interface AssistantToolRenderContextValue {
  isStreaming: boolean;
  editorRef?: RefObject<EditorRef | null>;
  onBatchApproval: (response: BatchApprovalResponse) => Promise<void> | void;
  onBatchUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

const AssistantToolRenderContext =
  createContext<AssistantToolRenderContextValue | null>(null);

/** 从 context 读 isStreaming，避免 stream 结束时换 Text 组件类型导致整段 remount */
function AssistantTextPart({ text }: TextMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  return (
    <AssistantStreamdownText text={text} isStreaming={ctx?.isStreaming ?? false} />
  );
}

function AssistantToolPart({ artifact }: ToolCallMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  if (!ctx) return null;
  const { isStreaming, editorRef, onBatchApproval, onBatchUndo } = ctx;
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
}

/** MessagePrimitive.Parts 的 components 必须模块级常量，避免 identity 抖动 */
const ASSISTANT_MESSAGE_PARTS = {
  Text: AssistantTextPart,
  Reasoning: EmptyReasoningPart,
  tools: { Override: AssistantToolPart },
};

/**
 * 首 token / 工具进度出现前的预热占位：thinking-orbs + border-beam。
 * 有正文立刻让位（不叠在气泡里）；输入 dock 的 beam 另有 BEAM_MIN_ACTIVE_MS 保底。
 */
function AssistantThinkingPlaceholder({ active }: { active: boolean }) {
  // 极短「还没首包」闪烁时，仍至少露一会思考态
  const show = useMinHoldActive(active, THINKING_PLACEHOLDER_MIN_MS);
  // 已有正文/进度时 active=false：若仍在 min-hold，继续显示会和正文叠层，故仅 active 时渲染
  if (!active || !show) return null;

  return (
    <GooseAiBorderBeam
      preset="streaming"
      active
      borderRadius={14}
      className="w-fit max-w-full"
    >
      <div
        className="flex items-center gap-2.5 rounded-[14px] bg-[var(--goose-interactive-hover)] px-3.5 py-2.5"
        aria-live="polite"
        aria-busy="true"
      >
        <GooseThinkingOrb phase="thinking" scale="inline" tempo="calm" />
        <span className="text-sm text-muted-foreground">思考中…</span>
      </div>
    </GooseAiBorderBeam>
  );
}

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

  const MessageActionBar = () => (
    <div className="notebook-ai-message-actions mt-1 flex h-6 min-h-6 items-center gap-1">
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="never"
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
    const skills = msg.metadata?.skills ?? [];
    const textSegments = buildUserMessageSegments(text, references, skills);

    return (
      <MessagePrimitive.Root className="notebook-ai-message flex flex-col items-end">
        {/* 不设 w-full：气泡随内容收缩并靠右；max-w 限制最长宽度，复制按钮与气泡右缘对齐 */}
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="notebook-ai-message-text space-y-2 rounded-[14px] rounded-tr-[4px] bg-[#58d7b8]/12 px-3 py-2 text-sm text-foreground leading-relaxed">
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
                {textSegments.map((segment, index) => {
                  if (segment.type === "text") {
                    return (
                      <span
                        key={`text-${index}`}
                        className="notebook-ai-message-inline-text"
                      >
                        {segment.text}
                      </span>
                    );
                  }
                  if (segment.type === "skill") {
                    return (
                      <span
                        key={segment.key}
                        data-ai-skill-chip=""
                        className="ai-composer-chip inline-flex max-w-full min-w-0 items-center truncate rounded-[6px] px-1.5 text-[11px] font-medium leading-none"
                        title={`本地 Skill：/${segment.skill.name}`}
                        aria-label={`本地 Skill：/${segment.skill.name}`}
                      >
                        /{segment.skill.name}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      data-ai-mention-chip=""
                      onClick={() => onOpenPage(segment.reference.pageId)}
                      className={cn(
                        "ai-composer-chip inline-flex max-w-full min-w-0 items-center truncate rounded-[6px] px-1.5 text-[11px] font-medium leading-none outline-none",
                        "hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      title={`打开“${segment.reference.titleSnapshot}”`}
                      aria-label={`打开引用文件：${segment.reference.titleSnapshot}`}
                    >
                      @{segment.reference.titleSnapshot}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <MessageActionBar />
        </div>
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
    const showToolProgress =
      progressToolParts.length > 0 &&
      shouldShowToolProgress(progressToolParts, isStreaming);
    const hasText = getTextPartText(msg).trim().length > 0;
    // 发送后、正文/工具进度都还没出来：用思考球 + 光束预热，避免空长条
    const needsThinkingPlaceholder =
      isStreaming && !hasText && !showToolProgress;

    const toolRenderValue: AssistantToolRenderContextValue = {
      ...toolRenderBase,
      isStreaming,
    };

    return (
      <AssistantToolRenderContext.Provider value={toolRenderValue}>
        <MessagePrimitive.Root
          className={cn(
            "notebook-ai-message space-y-2",
            // 仅预热占位时不铺整宽空壳；有正文后再用气泡底
            needsThinkingPlaceholder
              ? "w-fit max-w-full"
              : "rounded-[14px] bg-[var(--goose-interactive-hover)]/70 px-3.5 py-2.5",
          )}
        >
          <AssistantThinkingPlaceholder active={needsThinkingPlaceholder} />
          {showToolProgress ? (
            <ToolProgressCard
              parts={progressToolParts}
              isMessageStreaming={isStreaming}
            />
          ) : null}
          <MessagePrimitive.Parts components={ASSISTANT_MESSAGE_PARTS} />
          <MessagePrimitive.Error>
            <p className="text-xs text-destructive">这条回复生成失败。</p>
          </MessagePrimitive.Error>
          {/* 流式中不占位：避免底部空出一截操作栏高度 */}
          {!isStreaming ? <MessageActionBar /> : null}
        </MessagePrimitive.Root>
      </AssistantToolRenderContext.Provider>
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
              const timeLabel = showTimeById.get(sourceMessage.id);
              const body =
                sourceMessage.role === "user"
                  ? renderUserMessage(sourceMessage)
                  : renderAssistantMessage(
                      sourceMessage,
                      streamingMessageId === sourceMessage.id,
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
          <ThreadPrimitive.ViewportFooter className="sticky bottom-2 flex justify-center">
            <ThreadPrimitive.ScrollToBottom
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-foreground dark:hover:bg-[var(--goose-interactive-hover)] disabled:hidden"
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
