/**
 * 工具调用折叠卡片 — 运行中/完成/错误三态，Lucide 1.75 描边
 */
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  "tool-listNotebooks": "列出记事本",
  "tool-listPages": "列出页面",
  "tool-searchNotes": "搜索笔记",
  "tool-readPage": "读取页面",
  "tool-createPage": "创建页面",
  "tool-updatePage": "更新页面",
  "tool-replaceInPage": "批量替换",
  "tool-showTable": "生成表格",
  "tool-showChart": "生成图表",
};

interface ToolCallCardProps {
  toolName: string;
  state: string; // 'call' | 'partial-call' | 'result'
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function truncate(s: string, max = 200) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function renderValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return truncate(v);
  return truncate(JSON.stringify(v, null, 2));
}

export function ToolCallCard({
  toolName,
  state,
  input,
  output,
  errorText,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isRunning = state === "call" || state === "partial-call";
  const isError = !!errorText;
  const isDone = !isRunning && !isError;

  const label = TOOL_LABELS[toolName] ?? toolName.replace(/^tool-/, "");

  return (
    <div
      className={cn(
        "my-1 rounded-[8px] border text-xs",
        "border-border bg-[var(--goose-interactive-hover)]",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {isRunning ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
            strokeWidth={1.75}
          />
        ) : isError ? (
          <AlertCircle
            className="h-3.5 w-3.5 shrink-0 text-destructive"
            strokeWidth={1.75}
          />
        ) : (
          <CheckCircle2
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {label}
        </span>
        {expanded ? (
          <ChevronDown
            className="h-3 w-3 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        ) : (
          <ChevronRight
            className="h-3 w-3 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-1.5">
          {input !== undefined && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                参数
              </div>
              <pre className="whitespace-pre-wrap break-all text-muted-foreground font-mono text-[11px]">
                {renderValue(input)}
              </pre>
            </div>
          )}
          {isError && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-destructive">
                错误
              </div>
              <pre className="whitespace-pre-wrap break-all text-destructive font-mono text-[11px]">
                {errorText}
              </pre>
            </div>
          )}
          {isDone && output !== undefined && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                结果摘要
              </div>
              <pre className="whitespace-pre-wrap break-all text-muted-foreground font-mono text-[11px]">
                {renderValue(output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
