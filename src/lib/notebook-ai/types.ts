import type { UIMessage, InferUITools } from "ai";
import type { AiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";
import type { NotebookAiTools } from "./tools";

export interface NotebookAiMessageMetadata {
  displayText?: string;
  references?: AiFileReferenceAttrs[];
  implicitPage?: AiFileReferenceAttrs;
}

/** 序列化进持久化存储的单条消息格式 */
export type NotebookAiMessage = UIMessage<
  NotebookAiMessageMetadata,
  never,
  InferUITools<NotebookAiTools>
>;

export interface NotebookAiAgentContext {
  notebookId: string;
  currentPageId?: string | null;
}

/** 单个笔记本的会话状态 */
export interface NotebookAiChatState {
  messages: NotebookAiMessage[];
  updatedAt: number;
}

/** 持久化存储结构 */
export interface NotebookAiChatsPersistedState {
  /** notebookId -> 会话状态 */
  chats: Record<string, NotebookAiChatState>;
}

/** liveWriter 调用上下文 */
export interface LiveWriterContext {
  /** 当前绑定的笔记本 ID */
  notebookId: string;
  /** 本轮发送时绑定的当前页签页面 ID */
  currentPageId?: string | null;
}
