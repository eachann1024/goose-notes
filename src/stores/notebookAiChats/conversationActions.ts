import type {
  NotebookAiChatsState,
  NotebookAiConversation,
  NotebookAiNotebookChatState,
} from "./types";
import {
  normalizeMessages,
  pruneNotebookChats,
  createConversationId,
} from "./normalization";
import { CONVERSATION_STALE_MS } from "./types";

export function createConversationChatActions(
  set: import("zustand").StoreApi<NotebookAiChatsState>["setState"],
  get: import("zustand").StoreApi<NotebookAiChatsState>["getState"],
): Pick<
  NotebookAiChatsState,
  | "getActiveConversationId"
  | "getConversationMessages"
  | "listConversations"
  | "createConversation"
  | "ensureFreshActiveConversation"
  | "setActiveConversation"
> {
  return {
    getActiveConversationId: (notebookId) => {
      return get().chats[notebookId]?.activeConversationId ?? null;
    },

    getConversationMessages: (notebookId, conversationId) => {
      const notebookChat = get().chats[notebookId];
      const resolvedConversationId =
        conversationId ?? notebookChat?.activeConversationId;
      if (!resolvedConversationId) return [];

      return normalizeMessages(
        notebookChat?.conversations[resolvedConversationId]?.messages,
      );
    },

    listConversations: (notebookId) => {
      const conversations = Object.values(
        get().chats[notebookId]?.conversations ?? {},
      );

      return conversations
        .map((conversation) => ({
          ...conversation,
          messages: normalizeMessages(conversation.messages),
        }))
        .filter((conversation) => conversation.messages.length > 0)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    },

    createConversation: (notebookId) => {
      let conversationId = "";

      set((state) => {
        const now = Date.now();
        const currentNotebookChat = state.chats[notebookId];
        const emptyConversation = Object.values(
          currentNotebookChat?.conversations ?? {},
        )
          .filter((conversation) => conversation.messages.length === 0)
          .sort((left, right) => right.updatedAt - left.updatedAt)[0];

        if (emptyConversation) {
          conversationId = emptyConversation.id;
          return {
            chats: pruneNotebookChats(
              {
                ...state.chats,
                [notebookId]: {
                  ...currentNotebookChat,
                  activeConversationId: conversationId,
                  updatedAt: now,
                },
              },
              notebookId,
            ),
          };
        }

        conversationId = createConversationId();
        const conversation: NotebookAiConversation = {
          id: conversationId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        const notebookChat: NotebookAiNotebookChatState = {
          activeConversationId: conversationId,
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

      return conversationId;
    },

    ensureFreshActiveConversation: (notebookId, options) => {
      const now = options?.now ?? Date.now();
      const maxAgeMs = options?.maxAgeMs ?? CONVERSATION_STALE_MS;
      const notebookChat = get().chats[notebookId];
      const activeId = notebookChat?.activeConversationId ?? null;
      const activeConversation = activeId
        ? notebookChat?.conversations[activeId]
        : undefined;

      // 尚无会话，或当前就是空会话：直接落到可复用的空会话。
      if (!activeConversation || activeConversation.messages.length === 0) {
        return get().createConversation(notebookId);
      }

      // 以笔记本级 last touch 为准（发消息 / 切历史 / 新建 / 打开都会刷新），
      // 避免「只点开历史」后马上被 30 分钟规则误归档。
      const lastActiveAt = Math.max(
        notebookChat?.updatedAt ?? 0,
        activeConversation.updatedAt,
      );
      if (now - lastActiveAt < maxAgeMs) {
        // 恢复未过期会话时刷新 touch，把 30 分钟窗口从「最近一次打开」起算。
        get().setActiveConversation(notebookId, activeConversation.id);
        return activeConversation.id;
      }

      // 过期：旧会话保留在 conversations 里供历史列表读取，激活新空白会话。
      return get().createConversation(notebookId);
    },

    setActiveConversation: (notebookId, conversationId) => {
      set((state) => {
        const notebookChat = state.chats[notebookId];
        const conversation = notebookChat?.conversations[conversationId];
        if (!notebookChat || !conversation) return state;

        const now = Date.now();
        // 已是当前会话时仍刷新 touch 时间，表示用户再次打开/继续该会话。
        if (notebookChat.activeConversationId === conversationId) {
          return {
            chats: {
              ...state.chats,
              [notebookId]: {
                ...notebookChat,
                conversations: {
                  ...notebookChat.conversations,
                  [conversationId]: {
                    ...conversation,
                    updatedAt: now,
                  },
                },
                updatedAt: now,
              },
            },
          };
        }

        return {
          chats: {
            ...state.chats,
            [notebookId]: {
              ...notebookChat,
              activeConversationId: conversationId,
              conversations: {
                ...notebookChat.conversations,
                [conversationId]: {
                  ...conversation,
                  updatedAt: now,
                },
              },
              updatedAt: now,
            },
          },
        };
      });
    },
  };
}
