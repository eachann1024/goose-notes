import { toast } from "@/components/ui/sonner";
/** 正在等待 toast 确认的会话删除，防止重复触发 */
const conversationDeleteInFlight = new Set<string>();

/** 删除会话：走全局 sonner toast 确认，确认后回调执行真实删除 */
export function requestDeleteConversation(
  conversationId: string,
  summary: string,
  onConfirm: () => void,
) {
  if (conversationDeleteInFlight.has(conversationId)) return;
  const trimmedSummary = summary.trim() || "新会话";
  const displaySummary =
    trimmedSummary.length > 20
      ? `${trimmedSummary.slice(0, 20)}…`
      : trimmedSummary;
  const toastId = `delete-ai-conversation:${conversationId}`;

  // 从弹出确认 toast 起就占位，保证同一会话同时只有一个待确认 toast
  conversationDeleteInFlight.add(conversationId);
  toast.warning(`删除会话「${displaySummary}」？`, {
    id: toastId,
    duration: 8000,
    onDismiss: () => {
      conversationDeleteInFlight.delete(conversationId);
    },
    onAutoClose: () => {
      conversationDeleteInFlight.delete(conversationId);
    },
    action: {
      label: "确认删除",
      onClick: () => {
        try {
          onConfirm();
          toast.success("已删除会话", { id: toastId });
        } finally {
          conversationDeleteInFlight.delete(conversationId);
        }
      },
    },
  });
}
