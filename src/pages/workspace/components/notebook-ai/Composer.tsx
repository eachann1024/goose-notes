/**
 * 消息输入框：自动扩高，Enter 发送，流式中显示停止按钮
 */
import { useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "向 AI 提问… 回车发送，Shift+回车换行",
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      if (!isStreaming && !disabled && value.trim()) {
        onSend();
      }
      return;
    }
    // 阻止 Esc 冒泡到编辑器
    if (e.key === "Escape") {
      e.stopPropagation();
    }
  };

  const canSend = !isStreaming && !disabled && value.trim().length > 0;

  return (
    <div className="shrink-0 px-3 py-2.5">
      <div
        className={cn(
          "flex items-end gap-2 rounded-[10px] border border-border bg-background px-3 py-2",
          "focus-within:border-border",
          "transition-colors duration-150",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none leading-relaxed",
            "min-h-[24px] max-h-[200px]",
            (disabled || isStreaming) && "opacity-60 cursor-not-allowed",
          )}
          style={{ height: "24px" }}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] mb-0.5",
              "bg-[var(--goose-interactive-selected)] text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
            )}
            aria-label="停止生成"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] mb-0.5",
              "transition-colors duration-150",
              canSend
                ? "bg-[var(--goose-interactive-selected)] text-muted-foreground hover:text-foreground"
                : "text-muted-foreground opacity-50 cursor-not-allowed",
            )}
            aria-label="发送消息"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
