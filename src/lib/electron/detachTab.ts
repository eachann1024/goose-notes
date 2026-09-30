import {
  getWindowId,
  tabsPersistKey,
} from "@/lib/electron/windowContext";
import { useEditorSplit, writeTabSplitForWindow } from "@/stores/useEditorSplit";
import { useTabs } from "@/stores/useTabs";

/** 把标签挪到别的窗口后，源窗若已空则关掉（不再补欢迎页）。 */
export function detachTabFromThisWindow(
  tabId: string,
  destWindowId?: string,
): void {
  const split = useEditorSplit.getState();
  const tree = split.getStateForTab(tabId);
  if (tree && destWindowId) {
    writeTabSplitForWindow(destWindowId, tabId, tree);
  }
  const { emptied } = useTabs.getState().releaseTab(tabId);
  if (!emptied) return;
  try {
    window.localStorage.removeItem(tabsPersistKey(getWindowId()));
  } catch {
    // 忽略存储异常
  }
  void window.gooseDesktop?.closeWindow?.();
}
