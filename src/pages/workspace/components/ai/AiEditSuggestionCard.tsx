import { useState } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditSuggestion {
  /** 唯一标识，用于忽略/应用后更新状态 */
  id: string;
  /** 目标页面 ID */
  pageId: string;
  /** 目标页面标题（展示用） */
  pageTitle: string;
  /** 原文（段落级纯文本） */
  before: string;
  /** 改写后（段落级纯文本） */
  after: string;
}

interface AiEditSuggestionCardProps {
  suggestion: EditSuggestion;
  onApply: (suggestion: EditSuggestion) => void;
  onIgnore: (suggestionId: string) => void;
}

/**
 * Notion 风格 diff 卡片，嵌在 AI 气泡下方。
 * 删除内容：红色背景 + 删除线；新增内容：绿色背景高亮。
 */
export function AiEditSuggestionCard({
  suggestion,
  onApply,
  onIgnore,
}: AiEditSuggestionCardProps) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      onApply(suggestion);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
      {/* 页面标签 */}
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <LucideIcons.FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {suggestion.pageTitle}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">建议修改</span>
      </div>

      {/* diff 区域 */}
      <div className="divide-y divide-border/30">
        {/* 删除（before） */}
        <div className="flex gap-2 px-3 py-2.5">
          <span className="mt-0.5 text-[11px] font-bold text-red-500/70 shrink-0 select-none">−</span>
          <p
            className={cn(
              "text-[12px] leading-[1.6] text-red-600/80 dark:text-red-400/80",
              "line-through decoration-red-400/60",
              "whitespace-pre-wrap break-words",
            )}
          >
            {suggestion.before}
          </p>
        </div>

        {/* 新增（after） */}
        <div className="flex gap-2 bg-emerald-500/[0.06] px-3 py-2.5">
          <span className="mt-0.5 text-[11px] font-bold text-emerald-600/70 shrink-0 select-none">+</span>
          <p
            className={cn(
              "text-[12px] leading-[1.6] text-emerald-700 dark:text-emerald-300",
              "whitespace-pre-wrap break-words",
            )}
          >
            {suggestion.after}
          </p>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-end gap-2 border-t border-border/40 px-3 py-2">
        <button
          type="button"
          onClick={() => onIgnore(suggestion.id)}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          忽略
        </button>
        <button
          type="button"
          disabled={applying}
          onClick={() => void handleApply()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            applying
              ? "cursor-not-allowed bg-emerald-500/50 text-white"
              : "bg-emerald-500 text-white hover:bg-emerald-600",
          )}
        >
          {applying ? (
            <LucideIcons.LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <LucideIcons.Check className="h-3 w-3" />
          )}
          应用到页面
        </button>
      </div>
    </div>
  );
}
