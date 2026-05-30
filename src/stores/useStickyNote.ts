import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uToolsStorage } from "@/lib/storage";
import { usePages } from "@/stores/usePages";

interface StickyNoteState {
  /** 是否处于便签模式 */
  active: boolean;
  /** 当前便签显示的笔记 ID */
  pageId: string | null;
  /** 上次便签查看的笔记 ID（持久化，用于便签直达上次） */
  lastStickyPageId: string | null;
  /** 打开便签模式 */
  open: () => void;
  /** 选择笔记 */
  selectPage: (pageId: string) => void;
  /** 关闭便签模式 */
  close: () => void;
}

export const useStickyNote = create<StickyNoteState>()(
  persist(
    (set, get) => ({
      active: false,
      pageId: null,
      lastStickyPageId: null,
      open: () => {
        // 便签直达上次：校验 lastStickyPageId 仍存在且未 trashed，
        // 失效则回退到选择器（pageId:null），避免直达已删除笔记。
        const lastId = get().lastStickyPageId;
        const lastPage = lastId ? usePages.getState().pages[lastId] : null;
        if (lastPage && !lastPage.trashedAt) {
          // 同步 activePageId，保证便签正文/编辑落到正确笔记。
          void usePages.getState().setActivePage(lastId!);
          set({ active: true, pageId: lastId });
        } else {
          set({ active: true, pageId: null });
        }
      },
      selectPage: (pageId) => {
        // <Editor> 仅按 usePages().activePageId 渲染/回写，便签选页必须同步
        // activePageId，否则便签正文/编辑会落到工作区当前活动页（数据错位）。
        if (pageId) {
          void usePages.getState().setActivePage(pageId);
          // 仅在真实 id 时记录直达目标；onSwitchPage 用 selectPage("")
          // 返回选择器，空串/假值不得污染 lastStickyPageId。
          set({ pageId, lastStickyPageId: pageId });
        } else {
          set({ pageId });
        }
      },
      // close 仅重置 active/pageId，保留 lastStickyPageId 供下次直达。
      close: () => set({ active: false, pageId: null }),
    }),
    {
      name: "goose-note:sticky",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({ lastStickyPageId: state.lastStickyPageId }),
      skipHydration: true,
    },
  ),
);
