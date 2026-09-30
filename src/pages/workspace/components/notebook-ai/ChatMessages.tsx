/**
 * 消息列表组件 — Streamdown 渲染 text part，自动吸底，用户上滚暂停
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { Check } from "lucide-react";
import { ToolCallCard } from "./ToolCallCard";
import { TableCard } from "./TableCard";
import { ChartCard } from "./ChartCard";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";

const ANIMATE_OPTIONS = {
  animation: "blurIn" as const,
  duration: 250,
  sep: "word" as const,
};

/** 任务列表的原生 checkbox 替换为自绘勾选框（样式见 notebook-ai.css） */
function MdInput({
  node: _node,
  ...props
}: ComponentProps<"input"> & { node?: unknown }) {
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
}

interface ReasoningPartProps {
  text: string;
}

function ReasoningBlock({ text }: ReasoningPartProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1.5 rounded-[8px] border border-border bg-[var(--goose-interactive-hover)] text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] uppercase tracking-wide">思考过程</span>
        <span className="ml-auto text-[10px]">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 text-muted-foreground italic text-[11px] leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

export function ChatMessages({
  messages,
  streamingMessageId,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolled = useRef(false);
  const lastScrollTop = useRef(0);

  const scrollToBottom = useCallback((force = false) => {
    const el = containerRef.current;
    if (!el) return;
    if (force || !isUserScrolled.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 检测用户手动上滚
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const diff = el.scrollTop - lastScrollTop.current;
      lastScrollTop.current = el.scrollTop;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (atBottom) {
        isUserScrolled.current = false;
      } else if (diff < 0) {
        isUserScrolled.current = true;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 新消息到来时吸底
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 流式结束后强制吸底
  useEffect(() => {
    if (!streamingMessageId) {
      isUserScrolled.current = false;
      scrollToBottom(true);
    }
  }, [streamingMessageId, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-y-auto px-4"
      >
        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          向 AI 提问，让它帮你整理、搜索、创作笔记
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-3 [scrollbar-width:thin]"
    >
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isStreaming = streamingMessageId === msg.id;

        if (isUser) {
          const textPart = msg.parts?.find((p) => p.type === "text");
          const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
          return (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-[12px] rounded-tr-[4px] bg-[var(--goose-interactive-selected)] px-3 py-2 text-sm text-foreground leading-relaxed">
                {text}
              </div>
            </div>
          );
        }

        // assistant message
        return (
          <div key={msg.id} className="space-y-1">
            {msg.parts?.map((part, pi) => {
              const partType = part.type;

              if (partType === "text") {
                const textContent = (part as { text: string }).text;
                return (
                  <div key={pi} className="ai-md text-sm text-foreground">
                    <Streamdown
                      className="space-y-2"
                      components={MD_COMPONENTS}
                      isAnimating={isStreaming}
                      animated={ANIMATE_OPTIONS}
                      plugins={{ cjk }}
                      parseIncompleteMarkdown={isStreaming}
                    >
                      {textContent}
                    </Streamdown>
                  </div>
                );
              }

              if (partType === "reasoning") {
                const reasoningText = (part as { text: string }).text ?? "";
                return (
                  <ReasoningBlock key={pi} text={reasoningText} />
                );
              }

              // tool parts
              if (partType?.startsWith("tool-")) {
                const toolPart = part as {
                  type: string;
                  toolCallId: string;
                  state: string;
                  input?: unknown;
                  output?: unknown;
                };
                const state = toolPart.state ?? "";
                const output = toolPart.output;

                // showTable: output-available 渲染 TableCard
                if (partType === "tool-showTable" && state === "output-available" && output) {
                  const tableData = output as {
                    title?: string;
                    columns: string[];
                    rows: string[][];
                  };
                  return (
                    <div key={pi}>
                      <ToolCallCard
                        toolName={partType}
                        state={state}
                        input={toolPart.input}
                      />
                      <TableCard
                        title={tableData.title}
                        columns={tableData.columns}
                        rows={tableData.rows}
                      />
                    </div>
                  );
                }

                // showChart: output-available 渲染 ChartCard
                if (partType === "tool-showChart" && state === "output-available" && output) {
                  const chartData = output as {
                    type: "bar" | "line" | "pie";
                    title?: string;
                    categories?: string[];
                    series: Array<{ name: string; data: number[] }>;
                  };
                  return (
                    <div key={pi}>
                      <ToolCallCard
                        toolName={partType}
                        state={state}
                        input={toolPart.input}
                      />
                      <ChartCard
                        type={chartData.type}
                        title={chartData.title}
                        categories={chartData.categories}
                        series={chartData.series}
                      />
                    </div>
                  );
                }

                return (
                  <ToolCallCard
                    key={pi}
                    toolName={partType}
                    state={state}
                    input={toolPart.input}
                    output={output}
                  />
                );
              }

              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}
