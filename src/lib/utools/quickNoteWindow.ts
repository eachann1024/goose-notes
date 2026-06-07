import { getUToolsApi } from "./env";

/**
 * 速记小窗（独立 browser 窗口）自身的窗口控制封装。
 *
 * 关键约束（见项目 memory utools-createbrowserwindow-api）：
 * createBrowserWindow 返回的 win 只在「创建者侧」（主窗 preload）可用，且不含实例事件。
 * 因此子窗口不能直接调 win.setAlwaysOnTop / win.close，必须通过 utools.sendToParent
 * 把请求发回主窗 preload，由持有 win 的一方执行。失焦隐藏则由子窗内 web 原生 blur 触发。
 */
const send = (channel: string, ...args: unknown[]) => {
  const utools = getUToolsApi();
  if (utools && typeof utools.sendToParent === "function") {
    utools.sendToParent(channel, ...args);
    return true;
  }
  return false;
};

export const quickNoteWindow = {
  /** 置顶钉住开关（连带停用失焦隐藏，由主窗 preload 处理 win.setAlwaysOnTop）。 */
  setPinned(pinned: boolean): void {
    send("quicknote:pin", pinned);
  },

  /** 关闭小窗。优先请求主窗关闭（win.close），兜底 window.close()。 */
  close(): void {
    if (!send("quicknote:close")) {
      try {
        window.close();
      } catch {
        /* noop */
      }
    }
  },

  /** 通知主窗某条笔记已被小窗改动，主窗据此从 db 重读该页（防跨窗脏写）。 */
  notifyNoteUpdated(pageId: string): void {
    send("quicknote:note-updated", pageId);
  },

  /** 请求父窗把小窗高度设为 height（自动调整高度模式用；宽度不变）。 */
  setHeight(height: number): void {
    send("quicknote:set-height", Math.round(height));
  },

  /** 请求隐藏（失焦时调用，保留进程下次秒开）。 */
  hide(): void {
    if (!send("quicknote:hide")) {
      try {
        window.close();
      } catch {
        /* noop */
      }
    }
  },
};
