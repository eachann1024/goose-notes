import { getGooseDesktop } from "./runtime";

export const quickNoteWindow = {
  close: () => {
    void getGooseDesktop()?.closeQuicknote();
  },
  // Electron 主进程监听 quicknote 的 moved/resized 事件并写入窗口布局。
  // 渲染进程无需、也不能写入不存在的 preload API。
  persistPosition: (_x: number, _y: number) => {},
  persistSize: () => {},
};
