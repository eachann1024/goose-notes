import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uToolsStorage } from "@/lib/storage";
import { usePages } from "@/stores/usePages";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";

/**
 * 速记小窗状态（独立窗口进程内使用）。
 *
 * 小窗与主窗是两个独立的 WebView 进程，但共享同一份 uTools db。本 store 仅持久化
 * 「上次速记的笔记 id」与「置顶」偏好；当前正在编辑的 pageId 是会话态，不持久化。
 *
 * createBrowserWindow 拉起小窗时通过 URL hash 传入模式（new / last），小窗在
 * hydration 完成后据此 resolve 出要编辑的 pageId：
 * - new  → createPage 出一条空白笔记
 * - last → 直达 lastPageId；失效（不存在/已 trashed）则回退到 new
 */
interface QuickNoteState {
  /** 小窗当前正在编辑的笔记 id（会话态） */
  pageId: string | null;
  /** 上次速记的笔记 id（持久化，供「便签」指令直达） */
  lastPageId: string | null;
  /** 是否置顶钉住（持久化，跨次保持） */
  pinned: boolean;
  /** 记住的窗口高度（持久化，下次开窗沿用；手动拖动后更新） */
  windowHeight: number;
  /** 是否自动按内容调整窗口高度（持久化）。关闭时内容超出显示滚动条。 */
  autoResize: boolean;
  /** 按模式解析并设置当前要编辑的笔记，返回最终 pageId */
  resolveForMode: (mode: "new" | "last") => string;
  setPageId: (id: string) => void;
  setPinned: (pinned: boolean) => void;
  setWindowHeight: (height: number) => void;
  setAutoResize: (autoResize: boolean) => void;
}

/** 速记小窗默认高度，与 preload QUICKNOTE_HEIGHT 保持一致。 */
export const QUICKNOTE_DEFAULT_HEIGHT = 350;
/** 速记小窗最小高度，与 preload QUICKNOTE_MIN_HEIGHT 保持一致。 */
export const QUICKNOTE_MIN_HEIGHT = 300;

export const useQuickNote = create<QuickNoteState>()(
  persist(
    (set, get) => ({
      pageId: null,
      lastPageId: null,
      pinned: false,
      windowHeight: QUICKNOTE_DEFAULT_HEIGHT,
      autoResize: false,

      resolveForMode: (mode) => {
        const pagesStore = usePages.getState();
        const nbId =
          useNotebooks.getState().activeNotebookId ?? DEFAULT_NOTEBOOK;

        if (mode === "last") {
          const lastId = get().lastPageId;
          const lastPage = lastId ? pagesStore.getPage(lastId) : undefined;
          if (lastPage && !lastPage.trashedAt) {
            set({ pageId: lastId });
            return lastId!;
          }
          // 上次那条已失效：优雅回退到新建，不报错、不卡住。
        }

        const newId = pagesStore.createPage(undefined, nbId);
        set({ pageId: newId, lastPageId: newId });
        return newId;
      },

      setPageId: (id) => set({ pageId: id, lastPageId: id }),
      setPinned: (pinned) => set({ pinned }),
      setWindowHeight: (height) =>
        set({ windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)) }),
      setAutoResize: (autoResize) => set({ autoResize }),
    }),
    {
      name: "goose-note:quicknote",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        lastPageId: state.lastPageId,
        pinned: state.pinned,
        windowHeight: state.windowHeight,
        autoResize: state.autoResize,
      }),
      skipHydration: true,
    },
  ),
);
