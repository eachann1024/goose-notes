import type {
  NotebookAiConversation,
  NotebookAiNotebookChatState,
  LegacyNotebookAiChatState,
  NotebookAiChatsPersistedState,
} from "./types";
import {
  isRecord,
  normalizeMessages,
  normalizeTimestamp,
  pruneNotebookChats,
} from "./normalization";
import type { JSONContent } from "@/types";
import { stripComposerDraftImages } from "./composerDraft";

export function normalizeConversation(
  conversationId: string,
  value: unknown,
): NotebookAiConversation | null {
  if (!isRecord(value)) return null;

  const messages = normalizeMessages(value.messages);
  const fallbackTimestamp = Date.now();
  const updatedAt = normalizeTimestamp(value.updatedAt, fallbackTimestamp);
  const createdAt = normalizeTimestamp(value.createdAt, updatedAt);

  return {
    id: typeof value.id === "string" && value.id ? value.id : conversationId,
    messages,
    createdAt,
    updatedAt,
  };
}

export function normalizeNotebookChatState(
  value: Record<string, unknown>,
): NotebookAiNotebookChatState {
  const conversations = isRecord(value.conversations)
    ? Object.fromEntries(
        Object.entries(value.conversations).flatMap(
          ([conversationId, item]) => {
            const conversation = normalizeConversation(conversationId, item);
            return conversation ? [[conversation.id, conversation]] : [];
          },
        ),
      )
    : {};
  const conversationList = Object.values(conversations);
  const newestConversation = [...conversationList].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  )[0];
  const requestedActiveId =
    typeof value.activeConversationId === "string"
      ? value.activeConversationId
      : null;
  const activeConversationId =
    requestedActiveId && conversations[requestedActiveId]
      ? requestedActiveId
      : (newestConversation?.id ?? null);
  const newestUpdatedAt = newestConversation?.updatedAt ?? 0;

  return {
    activeConversationId,
    conversations,
    updatedAt: Math.max(
      normalizeTimestamp(value.updatedAt, newestUpdatedAt),
      newestUpdatedAt,
    ),
  };
}

export function migrateLegacyNotebookChatState(
  notebookId: string,
  value: LegacyNotebookAiChatState,
): NotebookAiNotebookChatState {
  const updatedAt = normalizeTimestamp(value.updatedAt, Date.now());
  const conversationId = `legacy-${notebookId}`;

  return {
    activeConversationId: conversationId,
    conversations: {
      [conversationId]: {
        id: conversationId,
        messages: normalizeMessages(value.messages),
        createdAt: updatedAt,
        updatedAt,
      },
    },
    updatedAt,
  };
}

export function normalizeComposerDrafts(
  value: unknown,
): Record<string, JSONContent | null> {
  if (!isRecord(value)) return {};
  const next: Record<string, JSONContent | null> = {};
  for (const [notebookId, draft] of Object.entries(value)) {
    if (!notebookId) continue;
    const cleaned = stripComposerDraftImages(
      draft as JSONContent | null | undefined,
    );
    if (cleaned) next[notebookId] = cleaned;
  }
  return next;
}

/** Zustand persist v0（单会话）到 v1（多会话）的兼容迁移。 */
export function migrateNotebookAiChatsState(
  persistedState: unknown,
): NotebookAiChatsPersistedState {
  if (!isRecord(persistedState) || !isRecord(persistedState.chats)) {
    return { chats: {}, composerDrafts: {} };
  }

  const chats = Object.fromEntries(
    Object.entries(persistedState.chats).flatMap(([notebookId, value]) => {
      if (!isRecord(value)) return [];

      const notebookChatState = isRecord(value.conversations)
        ? normalizeNotebookChatState(value)
        : migrateLegacyNotebookChatState(
            notebookId,
            value as unknown as LegacyNotebookAiChatState,
          );
      return [[notebookId, notebookChatState]];
    }),
  );

  return {
    chats: pruneNotebookChats(chats),
    composerDrafts: normalizeComposerDrafts(persistedState.composerDrafts),
  };
}
