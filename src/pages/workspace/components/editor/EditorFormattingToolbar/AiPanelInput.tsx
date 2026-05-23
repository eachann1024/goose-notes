import type { Dispatch, RefObject, SetStateAction } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import {
  TEXTAREA_MAX_HEIGHT,
  TEXTAREA_MIN_HEIGHT,
  TEXTAREA_MIN_ROWS,
  type AiPanelPhase,
} from "./useAiPanelState";

interface AiPanelInputProps {
  phase: AiPanelPhase;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  initialAction: "polish" | "rewrite" | "generate";
  onClose: () => void;
  handleSubmit: () => Promise<void>;
  handleCancel: () => void;
}

export function AiPanelInput({
  phase,
  query,
  setQuery,
  textareaRef,
  initialAction,
  onClose,
  handleSubmit,
  handleCancel,
}: AiPanelInputProps) {
  const placeholder =
    initialAction === "polish"
      ? "告诉 AI 怎么润色，或直接按回车..."
      : initialAction === "rewrite"
        ? "告诉 AI 怎么改写，或直接按回车..."
        : "让 AI 帮你写点什么...";

  const canSubmit = phase === "input" && query.trim().length > 0;
  const isProcessing = phase === "processing";

  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <div className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center">
        {isProcessing ? (
          <AiGradientIcon className="h-3.5 w-3.5" />
        ) : (
          <LucideIcons.Sparkles className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>

      <div className="relative min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isProcessing}
          placeholder={placeholder}
          rows={TEXTAREA_MIN_ROWS}
          className={cn(
            "block w-full resize-none rounded-md bg-transparent px-2 pt-1.5 pb-9 text-[13px] leading-[22px] text-foreground outline-none placeholder:text-muted-foreground/55",
            "disabled:opacity-60",
          )}
          style={{
            minHeight: TEXTAREA_MIN_HEIGHT,
            maxHeight: TEXTAREA_MAX_HEIGHT,
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isProcessing) void handleSubmit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LucideIcons.X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isProcessing) {
                handleCancel();
              } else {
                void handleSubmit();
              }
            }}
            disabled={!isProcessing && !canSubmit}
            aria-label={isProcessing ? "取消" : "发送"}
            className={cn(
              "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              isProcessing
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : canSubmit
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-muted/70 text-muted-foreground/60",
            )}
          >
            {isProcessing ? (
              <LucideIcons.Square className="h-2.5 w-2.5 fill-current" />
            ) : (
              <LucideIcons.ArrowUp className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
