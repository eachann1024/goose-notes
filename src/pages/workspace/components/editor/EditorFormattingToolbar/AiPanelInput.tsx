import { memo } from "react";
import type { RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { Textarea } from "@/components/ui/textarea";
import type { AiPanelPhase } from "./useAiPanelState";

interface AiPanelInputProps {
  phase: AiPanelPhase;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  initialAction: "polish" | "rewrite" | "generate";
  onClose: () => void;
  handleSubmit: () => Promise<void>;
  handleCancel: () => void;
}

export const AiPanelInput = memo(function AiPanelInput({
  phase,
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

  const isProcessing = phase === "processing";

  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <div className="mt-[5px] flex h-6 w-6 shrink-0 items-center justify-center">
        {isProcessing ? (
          <AiGradientIcon className="h-5 w-5" />
        ) : (
          <LucideIcons.Sparkles className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      <div className="relative min-w-0 flex-1">
        <Textarea
          ref={textareaRef}
          disabled={isProcessing}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            // 平台习惯：Mac ⌘+Enter / Win·Linux Ctrl+Enter 发送
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey) &&
              !isProcessing
            ) {
              event.preventDefault();
              void handleSubmit();
              return;
            }
            // 兼容：纯 Enter 也发送（保留原行为），Shift+Enter 换行
            if (event.key === "Enter" && !event.shiftKey && !isProcessing) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          className={cn(
            "min-h-[66px] resize-none rounded-md border-none bg-transparent px-2 pt-1.5 pb-9 text-[13px] leading-[22px] text-foreground outline-none placeholder:text-muted-foreground/55",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "disabled:cursor-default disabled:opacity-60",
          )}
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
            aria-label={isProcessing ? "取消" : "发送"}
            className={cn(
              "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              isProcessing
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-emerald-500 text-white hover:bg-emerald-600",
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
});
