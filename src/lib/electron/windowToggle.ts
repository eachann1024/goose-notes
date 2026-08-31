/**
 * Electron 桌面端窗口 toggle（全局热键由主进程处理；渲染层也可主动调用）。
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

export type WindowToggleAction = "hide" | "focus" | "show";

export function resolveWindowToggleAction(state: {
  visible: boolean;
  focused: boolean;
}): WindowToggleAction {
  if (!state.visible) return "show";
  if (state.focused) return "hide";
  return "focus";
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
