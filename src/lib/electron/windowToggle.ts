/**
 * Electron 桌面端窗口 toggle（全局热键由主进程处理；渲染层也可主动调用）。
 *
 * 「main」目标是最近活动的 workspace 窗（多窗时不是固定某一扇）。
 *
 * 同一热键三态切换：
 * - 不可见 → 显示并聚焦；
 * - 可见但未聚焦 → 只聚焦；
 * - 可见且已聚焦 → 隐藏。
 *
 * 纯函数 resolveWindowToggleAction 独立导出，供 unit 测试覆盖三态。
 */
import { getGooseDesktop } from "./runtime";

export type DesktopWindowToggleTarget = "main" | "quicknote";

/** 小窗里没有对应 UI 的动作：先唤出主窗，再在主窗执行。 */
export type DesktopWorkspaceAction =
  | "none"
  | "search"
  | "settings"
  | "ai-panel"
  | "new-note";

export type WindowToggleAction = "hide" | "focus" | "show";

export function resolveWindowToggleAction(state: {
  visible: boolean;
  focused: boolean;
}): WindowToggleAction {
  if (!state.visible) return "show";
  if (state.focused) return "hide";
  return "focus";
}

/** 全局搜索热键：窗口已在前台时不必再 show/focus/steal，避免 macOS 抢焦点卡一下。 */
export function shouldRaiseMainWindow(state: {
  visible: boolean;
  minimized: boolean;
  focused: boolean;
}): boolean {
  return !state.visible || state.minimized || !state.focused;
}

/**
 * 唤出速记不得把此前已 hide 的 workspace 带回来。
 * 最小化不算 hide，由系统自己保持；只回收「不可见」的工作区窗。
 */
export function shouldKeepWorkspaceHiddenAfterQuicknote(state: {
  visible: boolean;
}): boolean {
  return !state.visible;
}

export async function toggleDesktopWindow(
  label: DesktopWindowToggleTarget,
): Promise<void> {
  const api = getGooseDesktop();
  if (!api) return;
  try {
    if (label === "quicknote") await api.toggleQuicknote();
    else await api.toggleMainWindow();
  } catch (error) {
    console.warn(`[electron] 切换窗口 ${label} 失败`, error);
  }
}

/** 只显示并聚焦主窗，不走三态隐藏。小窗前台或功能需要主窗时用。 */
export async function showDesktopMainWindow(
  action: DesktopWorkspaceAction = "none",
): Promise<void> {
  const api = getGooseDesktop();
  if (!api?.showMainWindow) return;
  try {
    await api.showMainWindow(action);
  } catch (error) {
    console.warn("[electron] 显示主窗口失败", error);
  }
}
