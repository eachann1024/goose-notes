import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uToolsStorage } from "@/lib/storage";
import type { AiFileReferenceAttrs } from "@/pages/workspace/components/editor/ai-composer/referenceLookup";

// ── 持久化的消息结构（去掉 streaming / error 等瞬态字段）
export interface AiSessionMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AiFileReferenceAttrs[];
  error?: boolean;
}

// ── 一条历史会话
export interface AiSession {
  /** 会话唯一 ID */
  id: string;
  /** 显示标题：取自第一条用户消息（前 40 个字符） */
  title: string;
  /** 关联的笔记页 ID（可为 undefined，即仅在 workspace 级别发起的对话） */
  pageId: string | undefined;
  /** 消息列表（不含 streaming 中的临时消息） */
  messages: AiSessionMessage[];
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

interface AiSessionsState {
  /** 全部历史会话，按 updatedAt 倒序排列 */
  sessions: AiSession[];
  /** 当前活动会话 ID（null 表示新会话未保存） */
  activeSessionId: string | null;

  /** 保存 / 更新一条会话（首次保存时插入，后续覆盖） */
  saveSession: (session: Omit<AiSession, "createdAt" | "updatedAt"> & Partial<Pick<AiSession, "createdAt">>) => void;
  /** 切换到指定会话 */
  setActiveSession: (id: string | null) => void;
  /** 删除指定会话 */
  deleteSession: (id: string) => void;
  /** 清空所有历史 */
  clearSessions: () => void;
}

const MAX_SESSIONS = 50; // 最多保留 50 条历史，避免存储膨胀

export const useAiSessions = create<AiSessionsState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: null,

      saveSession: (session) =>
        set((state) => {
          const now = Date.now();
          const existing = state.sessions.find((s) => s.id === session.id);
          let updated: AiSession[];

          if (existing) {
            // 更新已有会话
            updated = state.sessions.map((s) =>
              s.id === session.id
                ? { ...s, ...session, updatedAt: now }
                : s,
            );
          } else {
            // 插入新会话
            const newSession: AiSession = {
              ...session,
              createdAt: session.createdAt ?? now,
              updatedAt: now,
            };
            updated = [newSession, ...state.sessions];
          }

          // 按 updatedAt 倒序，最多保留 MAX_SESSIONS 条
          updated = updated
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_SESSIONS);

          return { sessions: updated, activeSessionId: session.id };
        }),

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        })),

      clearSessions: () => set({ sessions: [], activeSessionId: null }),
    }),
    {
      name: "goose-note:ai-sessions", // uTools dbStorage key
      storage: createJSONStorage(() => uToolsStorage),
      // 只持久化 sessions，activeSessionId 每次启动重置
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
);
