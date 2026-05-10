import { create } from "zustand";

interface StickyNoteState {
  /** 是否处于便签模式 */
  active: boolean;
  /** 当前便签显示的笔记 ID */
  pageId: string | null;
  /** 打开便签模式 */
  open: () => void;
  /** 选择笔记 */
  selectPage: (pageId: string) => void;
  /** 关闭便签模式 */
  close: () => void;
}

export const useStickyNote = create<StickyNoteState>((set) => ({
  active: false,
  pageId: null,
  open: () => set({ active: true, pageId: null }),
  selectPage: (pageId) => set({ pageId }),
  close: () => set({ active: false, pageId: null }),
}));
