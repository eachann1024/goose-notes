import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AiResolvedTarget, AiStickyTarget, AiTargetSelection, AiWritePlan } from "@/lib/ai-write";
import type { AgentArtifact, AgentPlan } from "@/agent/core/types";
import { uToolsStorage } from "@/lib/storage";
import type { AiFileReferenceAttrs } from "@/pages/workspace/components/editor/ai-composer/referenceLookup";
import type { JSONContent } from "@/types";

// ── 持久化的消息结构（去掉 streaming / error 等瞬态字段）
export interface AiSessionMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AiFileReferenceAttrs[];
  error?: boolean;
  agentPlan?: AgentPlan | null;
  artifact?: AgentArtifact | null;
  writePlan?: AiWritePlan | null;
}

// ── 一条历史会话
export interface AiSession {
  /** 会话唯一 ID */
  id: string;
  /** 显示标题：取自第一条用户消息（前 40 个字符） */
  title: string;
  /** 旧字段：历史数据里可能存在，新逻辑不再依赖 */
  pageId?: string;
  /** AI 页面来源页 */
  originPageId?: string | null;
  /** AI 页面来源笔记本 */
  originNotebookId?: string | null;
  /** 当前会话最近一次解析出的目标 */
  resolvedTarget?: AiResolvedTarget | null;
  /** @deprecated 历史持久化字段，已不再由 UI 使用 */
  manualTargetSelection?: AiTargetSelection | null;
  /** 当前会话稳定写入目标 */
  stickyTarget?: AiStickyTarget | null;
  /** 最近一次待确认/已提交的写入计划 */
  lastWritePlan?: AiWritePlan | null;
  /** 最近一次成功写入页面 */
  lastCommittedPageId?: string | null;
  /** 最近一次 Agent 规划结果 */
  lastAgentPlan?: AgentPlan | null;
  /** 最近一次 Agent 产物 */
  lastArtifact?: AgentArtifact | null;
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
  /** 当前界面里的消息快照，支持中途切走后恢复 */
  activeMessages: AiSessionMessage[];
  /** 当前输入框草稿 */
  draftContent: JSONContent | null;
  /** 当前解析出的目标 */
  activeResolvedTarget: AiResolvedTarget | null;
  /** @deprecated 历史持久化字段，已不再由 UI 使用 */
  activeManualTargetSelection: AiTargetSelection | null;
  /** 当前稳定写入目标 */
  activeStickyTarget: AiStickyTarget | null;
  /** 当前 AI 页来源页 */
  activeOriginPageId: string | null;
  /** 当前 AI 页来源笔记本 */
  activeOriginNotebookId: string | null;
  /** 当前最近一次写入计划 */
  activeLastWritePlan: AiWritePlan | null;
  /** 当前最近一次成功写入页面 */
  activeLastCommittedPageId: string | null;
  /** 当前最近一次 Agent plan */
  activeLastAgentPlan: AgentPlan | null;
  /** 当前最近一次 Agent artifact */
  activeLastArtifact: AgentArtifact | null;

  /** 保存 / 更新一条会话（首次保存时插入，后续覆盖） */
  saveSession: (session: Omit<AiSession, "createdAt" | "updatedAt"> & Partial<Pick<AiSession, "createdAt">>) => void;
  /** 切换到指定会话 */
  setActiveSession: (id: string | null) => void;
  /** 保存当前界面消息快照 */
  setActiveMessages: (messages: AiSessionMessage[]) => void;
  /** 保存当前输入框草稿 */
  setDraftContent: (content: JSONContent | null) => void;
  setActiveResolvedTarget: (target: AiResolvedTarget | null) => void;
  /** @deprecated 历史持久化字段，已不再由 UI 使用 */
  setActiveManualTargetSelection: (target: AiTargetSelection | null) => void;
  setActiveStickyTarget: (target: AiStickyTarget | null) => void;
  setActiveOrigin: (params: {
    pageId?: string | null;
    notebookId?: string | null;
  }) => void;
  setActiveLastWritePlan: (plan: AiWritePlan | null) => void;
  setActiveLastCommittedPageId: (pageId: string | null) => void;
  setActiveLastAgentPlan: (plan: AgentPlan | null) => void;
  setActiveLastArtifact: (artifact: AgentArtifact | null) => void;
  resetActiveState: (params?: {
    pageId?: string | null;
    notebookId?: string | null;
  }) => void;
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
      activeMessages: [],
      draftContent: null,
      activeResolvedTarget: null,
      activeManualTargetSelection: null,
      activeStickyTarget: null,
      activeOriginPageId: null,
      activeOriginNotebookId: null,
      activeLastWritePlan: null,
      activeLastCommittedPageId: null,
      activeLastAgentPlan: null,
      activeLastArtifact: null,

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

      setActiveMessages: (messages) => set({ activeMessages: messages }),

      setDraftContent: (content) => set({ draftContent: content }),

      setActiveResolvedTarget: (target) => set({ activeResolvedTarget: target }),

      setActiveManualTargetSelection: (target) => set({ activeManualTargetSelection: target }),

      setActiveStickyTarget: (target) => set({ activeStickyTarget: target }),

      setActiveOrigin: ({ pageId, notebookId }) =>
        set({
          activeOriginPageId: pageId ?? null,
          activeOriginNotebookId: notebookId ?? null,
        }),

      setActiveLastWritePlan: (plan) => set({ activeLastWritePlan: plan }),

      setActiveLastCommittedPageId: (pageId) => set({ activeLastCommittedPageId: pageId }),

      setActiveLastAgentPlan: (plan) => set({ activeLastAgentPlan: plan }),

      setActiveLastArtifact: (artifact) => set({ activeLastArtifact: artifact }),

      resetActiveState: (params) =>
        set({
          activeSessionId: null,
          activeMessages: [],
          draftContent: null,
          activeResolvedTarget: null,
          activeManualTargetSelection: null,
          activeStickyTarget: null,
          activeOriginPageId: params?.pageId ?? null,
          activeOriginNotebookId: params?.notebookId ?? null,
          activeLastWritePlan: null,
          activeLastCommittedPageId: null,
          activeLastAgentPlan: null,
          activeLastArtifact: null,
        }),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          activeMessages:
            state.activeSessionId === id ? [] : state.activeMessages,
          activeResolvedTarget:
            state.activeSessionId === id ? null : state.activeResolvedTarget,
          activeManualTargetSelection:
            state.activeSessionId === id ? null : state.activeManualTargetSelection,
          activeStickyTarget:
            state.activeSessionId === id ? null : state.activeStickyTarget,
          activeOriginPageId:
            state.activeSessionId === id ? null : state.activeOriginPageId,
          activeOriginNotebookId:
            state.activeSessionId === id ? null : state.activeOriginNotebookId,
          activeLastWritePlan:
            state.activeSessionId === id ? null : state.activeLastWritePlan,
          activeLastCommittedPageId:
            state.activeSessionId === id ? null : state.activeLastCommittedPageId,
          activeLastAgentPlan:
            state.activeSessionId === id ? null : state.activeLastAgentPlan,
          activeLastArtifact:
            state.activeSessionId === id ? null : state.activeLastArtifact,
        })),

      clearSessions: () =>
        set({
          sessions: [],
          activeSessionId: null,
          activeMessages: [],
          draftContent: null,
          activeResolvedTarget: null,
          activeManualTargetSelection: null,
          activeStickyTarget: null,
          activeOriginPageId: null,
          activeOriginNotebookId: null,
          activeLastWritePlan: null,
          activeLastCommittedPageId: null,
          activeLastAgentPlan: null,
          activeLastArtifact: null,
        }),
    }),
    {
      name: "goose-note:ai-sessions", // uTools dbStorage key
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        activeMessages: state.activeMessages,
        draftContent: state.draftContent,
        activeResolvedTarget: state.activeResolvedTarget,
        activeManualTargetSelection: state.activeManualTargetSelection,
        activeStickyTarget: state.activeStickyTarget,
        activeOriginPageId: state.activeOriginPageId,
        activeOriginNotebookId: state.activeOriginNotebookId,
        activeLastWritePlan: state.activeLastWritePlan,
        activeLastCommittedPageId: state.activeLastCommittedPageId,
        activeLastAgentPlan: state.activeLastAgentPlan,
        activeLastArtifact: state.activeLastArtifact,
      }),
    },
  ),
);
