import { create } from "zustand";
import type { NotebookAiChatsState } from "./notebookAiChats/types";
import { persist, createJSONStorage } from "zustand/middleware";
import { createConversationChatActions } from "./notebookAiChats/conversationActions";
import { createContentChatActions } from "./notebookAiChats/contentActions";
import { NOTEBOOK_AI_CHATS_STORAGE_VERSION } from "./notebookAiChats/types";
import { localStorageAdapter } from "@/lib/storage";
import { migrateNotebookAiChatsState } from "./notebookAiChats/migrations";

export const useNotebookAiChats = create<NotebookAiChatsState>()(
  persist(
    (set, get) => ({
      chats: {},
      composerDrafts: {},
      ...createConversationChatActions(set, get),
      ...createContentChatActions(set, get),
    }),
    {
      name: "goose-note-notebook-ai-chats",
      version: NOTEBOOK_AI_CHATS_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorageAdapter),
      skipHydration: true,
      migrate: (persistedState: unknown) =>
        migrateNotebookAiChatsState(persistedState),
      // 只持久化数据字段，不持久化函数
      partialize: (state) => ({
        chats: state.chats,
        composerDrafts: state.composerDrafts,
      }),
    },
  ),
);

export {
  CONVERSATION_STALE_MS,
  type NotebookAiConversation,
  type NotebookAiNotebookChatState,
  type NotebookAiChatsState,
} from "./notebookAiChats/types";
export {
  stripComposerDraftImages,
  composerDraftHasContent,
} from "./notebookAiChats/composerDraft";
export { migrateNotebookAiChatsState } from "./notebookAiChats/migrations";
