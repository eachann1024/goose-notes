import type {
  NotebookAiChatsState,
  NotebookAiConversation,
  NotebookAiNotebookChatState,
} from "./types";
import {
  composerDraftHasContent,
  stripComposerDraftImages,
} from "./composerDraft";
import { normalizeMessages, pruneNotebookChats } from "./normalization";

export function createContentChatActions(
  set: import("zustand").StoreApi<NotebookAiChatsState>["setState"],
  get: import("zustand").StoreApi<NotebookAiChatsState>["getState"],
): Pick<
  NotebookAiChatsState,
  | "deleteConversation"
  | "setMessages"
  | "clearAllChats"
  | "getComposerDraft"
  | "setComposerDraft"
  | "clearComposerDraft"
> {
  return {
    deleteConversation: (notebookId, conversationId) => {
      set((state) => {
        const notebookChat = state.chats[notebookId];
        if (!notebookChat?.conversations[conversationId]) return state;

        const now = Date.now();
        const { [conversationId]: _removed, ...remainingConversations } =
          notebookChat.conversations;
        const remainingList = Object.values(remainingConversations);
        const newestRemaining = [...remainingList].sort(
          (left, right) => right.updatedAt - left.updatedAt,
        )[0];
        const nextActiveConversationId =
          notebookChat.activeConversationId === conversationId
            ? (newestRemaining?.id ?? null)
            : notebookChat.activeConversationId;

        const hasDraft = Boolean(
          composerDraftHasContent(state.composerDrafts[notebookId]),
        );
        if (remainingList.length === 0 && !hasDraft) {
          // 无会话且无草稿：连同笔记本记录一起移除，保持 LRU 语义干净
          const { [notebookId]: _removedChat, ...restChats } = state.chats;
          return { chats: restChats };
        }

        return {
          chats: {
            ...state.chats,
            [notebookId]: {
              activeConversationId: nextActiveConversationId,
              conversations: remainingConversations,
              updatedAt: now,
            },
          },
        };
      });
    },

    setMessages: (notebookId, conversationId, messages) => {
      set((state) => {
        const now = Date.now();
        const currentNotebookChat = state.chats[notebookId];
        const currentConversation =
          currentNotebookChat?.conversations[conversationId];
        const conversation: NotebookAiConversation = {
          id: conversationId,
          messages: normalizeMessages(messages),
          createdAt: currentConversation?.createdAt ?? now,
          updatedAt: now,
        };
        const notebookChat: NotebookAiNotebookChatState = {
          activeConversationId:
            currentNotebookChat?.activeConversationId ?? conversationId,
          conversations: {
            ...(currentNotebookChat?.conversations ?? {}),
            [conversationId]: conversation,
          },
          updatedAt: now,
        };

        return {
          chats: pruneNotebookChats(
            {
              ...state.chats,
              [notebookId]: notebookChat,
            },
            notebookId,
          ),
        };
      });
    },

    clearAllChats: () => set({ chats: {}, composerDrafts: {} }),

    getComposerDraft: (notebookId) => {
      return stripComposerDraftImages(get().composerDrafts[notebookId]);
    },

    setComposerDraft: (notebookId, content) => {
      const cleaned = stripComposerDraftImages(content);
      set((state) => {
        const previous = state.composerDrafts[notebookId] ?? null;
        if (!cleaned) {
          if (previous == null) return state;
          const { [notebookId]: _removed, ...rest } = state.composerDrafts;
          return { composerDrafts: rest };
        }
        if (previous === cleaned) return state;
        return {
          composerDrafts: {
            ...state.composerDrafts,
            [notebookId]: cleaned,
          },
        };
      });
    },

    clearComposerDraft: (notebookId) => {
      set((state) => {
        if (!(notebookId in state.composerDrafts)) return state;
        const { [notebookId]: _removed, ...rest } = state.composerDrafts;
        return { composerDrafts: rest };
      });
    },
  };
}
