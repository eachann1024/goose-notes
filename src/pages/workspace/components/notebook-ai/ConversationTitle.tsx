import { cn } from "@/lib/utils";
import { isEmptyConversationSummary } from "@/lib/notebook-ai/conversationSummary";

interface ConversationTitleProps {
  summary: string;
  className?: string;
  /** 未传时按 summary 是否为空态「新会话」判断 */
  muted?: boolean;
}

/** 只读会话标题：单行省略，完整文案走 title + aria-label。 */
export function ConversationTitle({
  summary,
  className,
  muted,
}: ConversationTitleProps) {
  const display = summary.trim() || "新会话";
  const isMuted = muted ?? isEmptyConversationSummary(display);

  return (
    <h2
      key={display}
      className={cn(
        "notebook-ai-conversation-title min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium leading-5",
        isMuted ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      title={display}
      aria-label={`会话标题：${display}`}
    >
      {display}
    </h2>
  );
}
