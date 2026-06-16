import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  uToolsStorage,
  readDbStorageJSON,
  writeDbStorageJSON,
} from "@/lib/storage";
import { usePages } from "@/stores/usePages";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import {
  createEmptyLocalPageContent,
} from "@/components/editor/utils/blocknote-content";
import type { JSONContent, Page } from "@/types";

/**
 * 速记小窗状态（独立窗口进程内使用）。
 *
 * 小窗与主窗是两个独立的 WebView 进程，但共享同一份 uTools db。小窗是「草稿便签」：
 * 不直接对应一条真实笔记，编辑内容只落到草稿存储（draftContent，持久化），不写进 pages、
 * 不进笔记列表 / 搜索。用户点左上角「保存到笔记本」才把草稿整体 createPageRecord 入库，
 * 随后清空草稿、回到空白便签。
 *
 * 持久化：draftContent（草稿内容）、pinned（置顶偏好）、windowWidth/windowHeight（窗口尺寸记忆）。
 * 当前正在编辑的 draftPage 是会话态（每个进程基于 draftContent 现造），不持久化。
 */
interface QuickNoteState {
  /** 草稿内容（持久化，关窗重开仍在；保存入库后清空回空白） */
  draftContent: JSONContent | null;
  /** 是否置顶钉住（持久化，跨次保持） */
  pinned: boolean;
  /** 记住的窗口宽度（持久化，下次开窗沿用；手动拖动后更新） */
  windowWidth: number;
  /** 记住的窗口高度（持久化，下次开窗沿用；手动拖动后更新） */
  windowHeight: number;
  /** 草稿内容变更（编辑器 onContentChange 调用，写入草稿存储） */
  setDraftContent: (content: JSONContent) => void;
  /**
   * 保存当前草稿到笔记本：以草稿内容新建一条真实笔记并落库，随后清空草稿。
   * 返回新笔记 id；草稿为空时返回 null（不产生空笔记）。
   */
  saveDraftToNotebook: () => string | null;
  /** 清空草稿，回到空白便签。 */
  clearDraft: () => void;
  setPinned: (pinned: boolean) => void;
  setWindowWidth: (width: number) => void;
  setWindowHeight: (height: number) => void;
  setWindowSize: (width: number, height: number) => void;
}

/** 速记小窗默认宽度，与 preload QUICKNOTE_WIDTH 保持一致。 */
export const QUICKNOTE_DEFAULT_WIDTH = 480;
/** 速记小窗最小宽度，与 preload minWidth 保持一致。 */
export const QUICKNOTE_MIN_WIDTH = 320;
/** 速记小窗默认高度，与 preload QUICKNOTE_HEIGHT 保持一致。 */
export const QUICKNOTE_DEFAULT_HEIGHT = 350;
/** 速记小窗最小高度，与 preload QUICKNOTE_MIN_HEIGHT 保持一致。 */
export const QUICKNOTE_MIN_HEIGHT = 300;

/** 判断草稿内容是否为空白（无任何可见文本）——避免保存出空笔记。 */
const isDraftEmpty = (content: JSONContent | null): boolean => {
  if (!content) return true;
  const text = JSON.stringify(content)
    .replace(/"type"|"text"|"content"|"styles"|"props"|"id"|"children"/g, "");
  // 粗判：内容里若不含任何中日韩 / 拉丁 / 数字字符，视为空白。
  return !/[\p{L}\p{N}]/u.test(text);
};

export const useQuickNote = create<QuickNoteState>()(
  persist(
    (set, get) => ({
      draftContent: createEmptyLocalPageContent(),
      pinned: false,
      windowWidth: QUICKNOTE_DEFAULT_WIDTH,
      windowHeight: QUICKNOTE_DEFAULT_HEIGHT,

      setDraftContent: (content) => set({ draftContent: content }),

      saveDraftToNotebook: () => {
        const content = get().draftContent;
        if (isDraftEmpty(content)) {
          get().clearDraft();
          return null;
        }
        const nbId =
          useNotebooks.getState().activeNotebookId ?? DEFAULT_NOTEBOOK;
        const id = usePages.getState().createPageRecord({
          workspaceId: nbId,
          content: content ?? undefined,
        });
        get().clearDraft();
        return id;
      },

      clearDraft: () => set({ draftContent: null }),

      setPinned: (pinned) => set({ pinned }),
      setWindowWidth: (width) =>
        set({ windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)) }),
      setWindowHeight: (height) =>
        set({ windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)) }),
      setWindowSize: (width, height) =>
        set({
          windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)),
          windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)),
        }),
    }),
    {
      name: "goose-note:quicknote",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        draftContent: state.draftContent,
        pinned: state.pinned,
        windowWidth: state.windowWidth,
        windowHeight: state.windowHeight,
      }),
      skipHydration: true,
    },
  ),
);

/** 造一个用于驱动编辑器的草稿 page（不入 pages map、不持久化为 page 快照）。 */
export function buildQuickNoteDraftPage(content: JSONContent | null): Page {
  const now = Date.now();
  return {
    id: "__quicknote_draft__",
    workspaceId: DEFAULT_NOTEBOOK,
    parentId: undefined,
    content: content ?? createEmptyLocalPageContent(),
    isFolder: false,
    isLocked: false,
    isFullWidth: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: now,
    updatedAt: now,
    order: now,
  };
}
