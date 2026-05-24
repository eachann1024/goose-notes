import type { RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIStreamPhase } from "@/lib/ai-provider";
import type { AiPanelPhase } from "./useAiPanelState";

const STREAM_PHASE_LABEL: Record<AIStreamPhase, string> = {
  connecting: "正在连接",
  thinking: "正在思考",
  generating: "正在生成",
  finishing: "正在整理",
};

interface AiPanelResultsProps {
  phase: AiPanelPhase;
  streamPhase: AIStreamPhase;
  streamText: string;
  reasoningText: string;
  errorMessage: string;
  outputScrollRef: RefObject<HTMLDivElement | null>;
  handleRetry: () => void;
}

export function AiPanelResults({
  phase,
  streamPhase,
  streamText,
  reasoningText,
  errorMessage,
  outputScrollRef,
  handleRetry,
}: AiPanelResultsProps) {
  const showSpinner =
    phase === "processing" &&
    (streamPhase === "connecting" || streamPhase === "finishing");

  if (phase !== "processing" && phase !== "error") {
    return null;
  }

  return (
    <div className="border-t border-border/40">
      {phase === "processing" && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="flex-1 text-[12px] font-medium text-muted-foreground">
            {STREAM_PHASE_LABEL[streamPhase]}
          </span>
          {showSpinner ? (
            <LucideIcons.LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/60" />
          ) : (
            <div className="flex items-center gap-0.5">
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: "0ms", animationDuration: "1s" }}
              />
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                style={{
                  animationDelay: "200ms",
                  animationDuration: "1s",
                }}
              />
              <span
                className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                style={{
                  animationDelay: "400ms",
                  animationDuration: "1s",
                }}
              />
            </div>
          )}
        </div>
      )}

      {phase === "processing" && (
        <div
          ref={outputScrollRef}
          className="max-h-[120px] overflow-y-auto px-3 pb-2"
        >
          {reasoningText && (
            <div
              className={cn(
                "whitespace-pre-wrap break-words text-[11px] italic leading-5 text-muted-foreground/70 transition-opacity",
                streamPhase === "thinking" || streamPhase === "connecting"
                  ? "opacity-100"
                  : "opacity-60",
              )}
            >
              {reasoningText}
            </div>
          )}
          {streamText && (
            <div
              className={cn(
                "whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground",
                reasoningText ? "mt-2 border-t border-border/30 pt-2" : "",
              )}
            >
              {streamText}
            </div>
          )}
          {!streamText && !reasoningText && (
            <div className="text-[11px] italic text-muted-foreground/50">
              AI 正在准备回复...
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <LucideIcons.AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span className="flex-1 text-[12px] font-medium text-destructive">
              请求失败
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LucideIcons.RotateCcw className="h-3 w-3" />
              重试
            </button>
          </div>
          {errorMessage && (
            <div className="whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
