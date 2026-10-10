import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import { sanitizeNotebookAiMessages } from "@/lib/notebook-ai/messageUtils";

/** 每次只更新目标工具；异步审批不得用旧消息快照覆盖后来加入的消息。 */
export function updatePlanMessages(
  messages: NotebookAiMessage[],
  toolCallId: string,
  update: (part: Record<string, unknown>) => Record<string, unknown>,
) {
  return sanitizeNotebookAiMessages(
    messages.map((message) => ({
      ...message,
      parts: (message.parts ?? []).map((part) =>
        typeof part === "object" &&
        part &&
        "toolCallId" in part &&
        part.toolCallId === toolCallId
          ? update(part as unknown as Record<string, unknown>)
          : part,
      ),
    })) as NotebookAiMessage[],
  );
}
