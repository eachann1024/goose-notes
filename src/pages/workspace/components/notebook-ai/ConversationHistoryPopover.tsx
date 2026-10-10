import { PortalHoverTip } from "./history/PortalHoverTip";
import { requestDeleteConversation } from "./history/historyActions";
import { useMemo, type MouseEvent, useState } from "react";
import {
  Check,
  Clock3,
  History as HistoryIcon,
  MessageSquareText,
  Trash2,
} from "@/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getConversationSummary } from "@/lib/notebook-ai/conversationSummary";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { cn } from "@/lib/utils";

export interface ConversationHistoryListProps {
  notebookId: string;
  onSelectConversation: (conversationId: string) => void;
  /** 选中后回调（用于关闭外层菜单） */
  onDidSelect?: () => void;
  /** 删除会话回调；未提供时不显示删除按钮 */
  onDeleteConversation?: (conversationId: string) => void;
  className?: string;
  compact?: boolean;
}

export interface ConversationHistoryPopoverProps {
  notebookId: string;
  onSelectConversation: (conversationId: string) => void;
  disabled?: boolean;
}

/** 显示到时分秒；非今日附带月日（跨年再带年份） */
function formatConversationTime(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const time = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return time;

  const datePart = date.toLocaleDateString("zh-CN", {
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    month: "short",
    day: "numeric",
  });

  return `${datePart} ${time}`;
}

export function ConversationHistoryList({
  notebookId,
  onSelectConversation,
  onDidSelect,
  onDeleteConversation,
  className,
  compact = false,
}: ConversationHistoryListProps) {
  const notebookChatState = useNotebookAiChats(
    (state) => state.chats[notebookId],
  );
  const activeConversationId = notebookChatState?.activeConversationId ?? null;
  const conversations = useMemo(
    () =>
      Object.values(notebookChatState?.conversations ?? {})
        .filter((conversation) => conversation.messages.length > 0)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [notebookChatState],
  );

  const selectConversation = (conversationId: string) => {
    if (conversationId !== activeConversationId) {
      onSelectConversation(conversationId);
    }
    onDidSelect?.();
  };

  const confirmDeleteConversation = (
    event: MouseEvent<HTMLElement>,
    conversationId: string,
    summary: string,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onDeleteConversation) return;
    requestDeleteConversation(conversationId, summary, () => {
      onDeleteConversation(conversationId);
    });
  };

  if (conversations.length === 0) {
    return (
      <div
        className={
          className ??
          "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground"
        }
      >
        <MessageSquareText className="h-5 w-5" strokeWidth={1.5} />
        <span className="text-xs">暂无历史会话</span>
      </div>
    );
  }

  const list = (
    <div className="min-w-0 max-w-full space-y-0.5 overflow-x-hidden pr-1">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        const summary = getConversationSummary(conversation.messages);

        return (
          <PortalHoverTip key={conversation.id} content={summary}>
            {({ onMouseEnter, onMouseLeave }) => (
              <div
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(conversation.id)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  selectConversation(conversation.id);
                }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                className="group flex w-full min-w-0 max-w-full cursor-pointer items-center gap-2 overflow-hidden rounded-[8px] px-2.5 py-2 text-left text-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                aria-current={isActive ? "true" : undefined}
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="block w-full truncate text-sm">{summary}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)]">
                    <Clock3 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">
                      {formatConversationTime(conversation.updatedAt)}
                    </span>
                  </div>
                </div>
                {isActive ? (
                  <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-foreground group-hover:text-[var(--goose-interactive-hover-fg)]">
                    <Check className="h-3 w-3" strokeWidth={2} />
                    当前
                  </span>
                ) : null}
                {onDeleteConversation ? (
                  <button
                    type="button"
                    aria-label="删除会话"
                    title="删除会话"
                    onClick={(event) =>
                      confirmDeleteConversation(event, conversation.id, summary)
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 outline-none transition-[opacity,color,background-color] hover:bg-[var(--goose-color-danger-subtle-bg)] hover:text-[var(--goose-color-danger-focus)] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            )}
          </PortalHoverTip>
        );
      })}
    </div>
  );

  if (compact) {
    return <div className={cn("min-w-0 max-w-full", className)}>{list}</div>;
  }

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-1.5",
        className,
      )}
      style={{ maxHeight: Math.min(conversations.length * 58 + 12, 300) }}
    >
      {list}
    </div>
  );
}

export function ConversationHistoryPopover({
  notebookId,
  onSelectConversation,
  disabled = false,
}: ConversationHistoryPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(nextOpen) => {
        if (!disabled) setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:pointer-events-none disabled:text-disabled data-[state=open]:bg-[var(--goose-interactive-selected)] dark:data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]"
          aria-label="历史会话"
          title="历史会话"
          disabled={disabled}
        >
          <HistoryIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 max-w-72 overflow-hidden p-0"
      >
        <ConversationHistoryList
          notebookId={notebookId}
          onSelectConversation={onSelectConversation}
          onDidSelect={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
