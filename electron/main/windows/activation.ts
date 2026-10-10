import { app, BrowserWindow } from "electron";
import {
  resolveWindowToggleAction,
  shouldKeepWorkspaceHiddenAfterQuicknote,
  shouldRaiseMainWindow,
} from "../../../src/lib/electron/windowToggle";
import { setHiddenThrottle } from "./configuration";
import { markQuicknoteActivateSuppressed } from "./visibility";
import { createWorkspaceWindow } from "./workspace";
import { createQuicknoteWindow } from "./quicknote";
import { getMainWindow, getQuicknoteWindow } from "./registry";
import { registry, workspacesHeldHidden } from "./state";

export function waitReadyToShow(
  win: BrowserWindow,
  timeoutMs = 8000,
): Promise<void> {
  if (
    win.isDestroyed() ||
    win.webContents.isDestroyed() ||
    !win.webContents.isLoading()
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    win.once("ready-to-show", done);
    win.once("closed", done);
    win.webContents.once("did-finish-load", done);
  });
}

/** 全局热键唤出时必须抢前台；macOS 不 steal 时 frameless 小窗常常不出现。 */
export function raiseWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  workspacesHeldHidden.delete(win);
  if (win.isMinimized()) win.restore();
  setHiddenThrottle(win, false);
  win.show();
  win.moveTop();
  win.focus();
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
}

export function listHiddenWorkspaceWindows(): BrowserWindow[] {
  const hidden: BrowserWindow[] = [];
  for (const record of registry.workspaces()) {
    const workspace = record.win;
    if (!workspace || workspace.isDestroyed()) continue;
    if (
      shouldKeepWorkspaceHiddenAfterQuicknote({
        visible: workspace.isVisible(),
      })
    ) {
      hidden.push(workspace);
    }
  }
  return hidden;
}

export function focusedWorkspaceWindow(): BrowserWindow | null {
  for (const record of registry.workspaces()) {
    const workspace = record.win;
    if (
      workspace &&
      !workspace.isDestroyed() &&
      workspace.isVisible() &&
      !workspace.isMinimized() &&
      workspace.isFocused()
    ) {
      return workspace;
    }
  }
  return null;
}

export function restoreHiddenWorkspaces(hidden: BrowserWindow[]): void {
  for (const workspace of hidden) {
    if (workspace.isDestroyed() || !workspace.isVisible()) continue;
    workspace.hide();
  }
}

/**
 * 只抬速记窗，不激活整个应用。
 * macOS 上 win.show() / app.focus({ steal }) 会 unhide 同 app 里已 hide 的 workspace。
 */
export function raiseQuicknoteWindow(win: BrowserWindow): void {
  markQuicknoteActivateSuppressed();
  const workspace = focusedWorkspaceWindow();
  const hiddenWorkspaces = listHiddenWorkspaceWindows();
  for (const workspace of hiddenWorkspaces) {
    workspacesHeldHidden.add(workspace);
  }
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  setHiddenThrottle(win, false);
  if (process.platform === "darwin") {
    win.showInactive();
    win.moveTop();
    win.focus();
  } else {
    win.show();
    win.moveTop();
    win.focus();
  }
  restoreHiddenWorkspaces(hiddenWorkspaces);
  // panel 获得焦点后，macOS 可能把原本在前面的 workspace 降到别的应用后面；
  // 恢复普通窗层级，再让 floating panel 保持在它上面。
  if (workspace && !workspace.isDestroyed()) {
    workspace.moveTop();
    win.moveTop();
  }
  if (hiddenWorkspaces.length === 0) return;
  setImmediate(() => {
    markQuicknoteActivateSuppressed();
    restoreHiddenWorkspaces(hiddenWorkspaces);
  });
  setTimeout(() => {
    for (const workspace of hiddenWorkspaces) {
      workspacesHeldHidden.delete(workspace);
    }
  }, 1_500);
}

export async function toggleWindow(win: BrowserWindow | null): Promise<void> {
  if (!win || win.isDestroyed()) return;
  const visible = win.isVisible();
  const focused = visible && win.isFocused();
  const action = resolveWindowToggleAction({ visible, focused });
  if (action === "hide") {
    win.hide();
    setHiddenThrottle(win, true);
    return;
  }
  raiseWindow(win);
}

/**
 * 首次唤起才创建速记窗，避免启动就多一个 renderer。
 *
 * 速记快捷键是严格二态切换：只要窗口可见，再次按键就关闭，不因全局
 * 快捷键触发时焦点短暂转移而重新聚焦。这里不调用 toggleWindow，避免改变
 * workspace 窗口原有的「可见但未聚焦时先聚焦」行为。
 */
export async function toggleQuicknoteWindow(): Promise<void> {
  let win = getQuicknoteWindow();
  if (!win) {
    win = createQuicknoteWindow();
    await waitReadyToShow(win);
    if (win.isDestroyed()) return;
    raiseQuicknoteWindow(win);
    return;
  }
  if (win.isVisible()) {
    closeQuicknote();
    return;
  }
  raiseQuicknoteWindow(win);
}

export function closeQuicknote(): void {
  const win = getQuicknoteWindow();
  if (!win || win.isDestroyed()) return;
  markQuicknoteActivateSuppressed();
  win.close();
}

/** 全局搜索热键：显示并聚焦最近活动 workspace 窗，不 toggle 隐藏。已在前台则跳过 raise，避免 steal focus 卡顿。 */
export function showAndFocusMainWindow(): void {
  showOrCreateMainWindow();
}

/**
 * 只显示主窗，不走三态隐藏。小窗前台、功能转发、搜索热键都走这里。
 * 没有 workspace 时补开一扇空白窗。
 */
export function showOrCreateMainWindow(): BrowserWindow {
  let win = getMainWindow();
  if (!win || win.isDestroyed()) {
    win = createWorkspaceWindow({ mode: "blank" });
  }
  workspacesHeldHidden.delete(win);
  if (
    shouldRaiseMainWindow({
      visible: win.isVisible(),
      minimized: win.isMinimized(),
      focused: win.isFocused(),
    })
  ) {
    raiseWindow(win);
  }
  return win;
}
