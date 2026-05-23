import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { UToolsAdapter } from "@/lib/utools";
import { cn } from "@/lib/utils";
import type { AiConversationMessage } from "./useAiSessionHistory";

interface AssistantMessageActionsProps {
  message: AiConversationMessage;
  messageIndex: number;
  isStreaming: boolean;
  onRegenerate: (messageIndex: number) => void;
  onSwitchVersion: (messageId: string, versionIndex: number) => void;
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition-colors",
        disabled
          ? "pointer-events-none text-muted-foreground/30"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function AssistantMessageActions({
  message,
  messageIndex,
  isStreaming,
  onRegenerate,
  onSwitchVersion,
}: AssistantMessageActionsProps) {
  const versions = message.versions;
  const hasMultipleVersions = (versions?.length ?? 0) > 1;
  const activeIndex = message.activeVersionIndex ?? 0;

  const handleCopy = () => {
    const textToCopy =
      message.artifact?.type === "text_response"
        ? (message.artifact as { text: string }).text
        : message.text;
    UToolsAdapter.copyToClipboard(textToCopy);
    toast.success("已复制");
  };

  const handleRegenerate = () => {
    onRegenerate(messageIndex);
  };

  const handlePrevVersion = () => {
    if (activeIndex > 0) {
      onSwitchVersion(message.id, activeIndex - 1);
    }
  };

  const handleNextVersion = () => {
    if (versions && activeIndex < versions.length - 1) {
      onSwitchVersion(message.id, activeIndex + 1);
    }
  };

  return (
    <div className="mt-1 flex items-center gap-0.5">
      {hasMultipleVersions && (
        <>
          <ActionButton onClick={handlePrevVersion} disabled={activeIndex <= 0}>
            <LucideIcons.ChevronLeft className="h-3 w-3" />
          </ActionButton>
          <span className="px-1 text-[11px] tabular-nums text-muted-foreground/70 select-none">
            {activeIndex + 1}/{versions!.length}
          </span>
          <ActionButton onClick={handleNextVersion} disabled={activeIndex >= versions!.length - 1}>
            <LucideIcons.ChevronRight className="h-3 w-3" />
          </ActionButton>
          <span className="mx-1 text-border">·</span>
        </>
      )}
      <ActionButton onClick={handleCopy}>
        <LucideIcons.Copy className="h-3 w-3" />
        复制
      </ActionButton>
      {!isStreaming && (
        <ActionButton onClick={handleRegenerate}>
          <LucideIcons.RefreshCw className="h-3 w-3" />
          重新生成
        </ActionButton>
      )}
    </div>
  );
}
