import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { JSONContent } from "@/types";

/** 每个会话最多保留的消息条数 */
export const MAX_MESSAGES_PER_CONVERSATION = 60;

/** 最多持久化聊天记录的笔记本数 */
export const MAX_NOTEBOOKS = 20;

/** 超过此时长未活跃的会话视为归档：再次打开 AI 进入空白新会话，旧会话留在历史里 */
export const CONVERSATION_STALE_MS = 30 * 60 * 1000;

export const NOTEBOOK_AI_CHATS_STORAGE_VERSION = 1;

export interface NotebookAiConversation {
  id: string;
  messages: NotebookAiMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface NotebookAiNotebookChatState {
  activeConversationId: string | null;
  conversations: Record<string, NotebookAiConversation>;
  /** 用于超过笔记本上限时淘汰最久未使用的记录 */
  updatedAt: number;
}

export interface NotebookAiChatsPersistedState {
  /** notebookId -> 多会话状态 */
  chats: Record<string, NotebookAiNotebookChatState>;
  /**
   * 输入框草稿（按笔记本隔离）。
   * 关面板 / 切页 / 退出插件后恢复文本与 @ 引用；图片不持久化。
   */
  composerDrafts: Record<string, JSONContent | null>;
}

export interface LegacyNotebookAiChatState {
  messages: NotebookAiMessage[];
  updatedAt: number;
}

export interface NotebookAiChatsState extends NotebookAiChatsPersistedState {
  /** 获取当前激活的会话 ID；尚未创建会话时返回 null */
  getActiveConversationId: (notebookId: string) => string | null;
  /** 获取指定会话的消息；省略 conversationId 时读取当前会话 */
  getConversationMessages: (
    notebookId: string,
    conversationId?: string,
  ) => NotebookAiMessage[];
  /** 获取历史会话，排除空会话并按最近更新时间倒序排列 */
  listConversations: (notebookId: string) => NotebookAiConversation[];
  /** 新建并激活空会话；已有空会话时直接复用 */
  createConversation: (notebookId: string) => string;
  /**
   * 打开 AI 面板时解析当前会话：
   * - 无激活 / 空会话 → 返回（或创建）空会话
   * - 有消息且最近活跃未超过 maxAgeMs → 继续该会话
   * - 有消息但已过期 → 归档（留在历史），新建空白会话
   */
  ensureFreshActiveConversation: (
    notebookId: string,
    options?: { now?: number; maxAgeMs?: number },
  ) => string;
  /** 激活已存在的会话；会话不存在时不修改状态 */
  setActiveConversation: (notebookId: string, conversationId: string) => void;
  /**
   * 删除指定会话；删除激活会话时回退到剩余会话中最新的一条。
   * 笔记本下已无会话且无输入草稿时，一并移除该笔记本的记录。
   */
  deleteConversation: (notebookId: string, conversationId: string) => void;
  /** 更新指定会话的消息 */
  setMessages: (
    notebookId: string,
    conversationId: string,
    messages: NotebookAiMessage[],
  ) => void;
  /** 清空全部笔记本会话记录（数据重置/整包恢复使用） */
  clearAllChats: () => void;
  /** 读取指定笔记本的输入草稿（已去掉无法恢复的图片 token） */
  getComposerDraft: (notebookId: string) => JSONContent | null;
  /** 写入输入草稿；传 null 或空内容则清除 */
  setComposerDraft: (
    notebookId: string,
    content: JSONContent | null | undefined,
  ) => void;
  /** 清除指定笔记本的输入草稿 */
  clearComposerDraft: (notebookId: string) => void;
}
