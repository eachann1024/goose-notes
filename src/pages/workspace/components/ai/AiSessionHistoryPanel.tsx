import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiSession } from "@/stores/useAiSessions";

interface SessionHistoryPanelProps {
  sessions: AiSession[];
  activeSessionId: string | null;
  onSelectSession: (session: AiSession) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

function formatSessionTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function AiSessionHistoryPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onClose,
}: SessionHistoryPanelProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <LucideIcons.History className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">暂无历史会话</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={cn(
            "group flex cursor-pointer items-start gap-2 rounded-[10px] px-2.5 py-2 transition-colors",
            session.id === activeSessionId
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/60",
          )}
          onClick={() => {
            onSelectSession(session);
            onClose();
          }}
        >
          <LucideIcons.MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-foreground">
              {session.title}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {formatSessionTime(session.updatedAt)} · {session.messages.filter((m) => m.role === "user").length} 条提问
            </div>
          </div>
          <button
            type="button"
            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(session.id);
            }}
          >
            <LucideIcons.X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
