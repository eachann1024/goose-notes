import { prepareNotebookAiMessagesForPersistence } from "@/lib/notebook-ai/messageUtils";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import { MAX_MESSAGES_PER_CONVERSATION, MAX_NOTEBOOKS } from "./types";
import type { NotebookAiNotebookChatState } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return prepareNotebookAiMessagesForPersistence(
    value as NotebookAiMessage[],
  ).slice(-MAX_MESSAGES_PER_CONVERSATION);
}

export function createConversationId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function pruneNotebookChats(
  chats: Record<string, NotebookAiNotebookChatState>,
  protectedNotebookId?: string,
) {
  const notebookIds = Object.keys(chats);
  if (notebookIds.length <= MAX_NOTEBOOKS) return chats;

  const hasRealHistory = (notebookId: string) =>
    Object.values(chats[notebookId].conversations).some(
      (conversation) => conversation.messages.length > 0,
    );
  let removeCount = notebookIds.length - MAX_NOTEBOOKS;
  const nextChats = { ...chats };
  const oldestFirst = (left: string, right: string) => {
    const updatedAtDifference = chats[left].updatedAt - chats[right].updatedAt;
    return updatedAtDifference || left.localeCompare(right);
  };

  // 空会话只是面板的临时占位，不能为了它淘汰已有真实历史。
  const emptyCandidates = notebookIds
    .filter((notebookId) => notebookId !== protectedNotebookId)
    .filter((notebookId) => !hasRealHistory(notebookId))
    .sort(oldestFirst);

  for (const notebookId of emptyCandidates.slice(0, removeCount)) {
    delete nextChats[notebookId];
    removeCount -= 1;
  }

  if (removeCount <= 0) return nextChats;
  if (
    protectedNotebookId &&
    nextChats[protectedNotebookId] &&
    !hasRealHistory(protectedNotebookId)
  ) {
    return nextChats;
  }

  const historyCandidates = Object.keys(nextChats)
    .filter((notebookId) => notebookId !== protectedNotebookId)
    .filter((notebookId) => hasRealHistory(notebookId))
    .sort(oldestFirst);

  for (const notebookId of historyCandidates.slice(0, removeCount)) {
    delete nextChats[notebookId];
  }
  return nextChats;
}
