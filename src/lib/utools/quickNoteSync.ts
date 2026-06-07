import { usePages } from "@/stores/usePages";
import { getUToolsApi } from "./env";

/**
 * 主窗 → 速记小窗 的反向同步推送。
 *
 * 订阅 pages 变化，把 updatedAt 发生变化的页 id 推给小窗（经 preload 的
 * window.gooseQuickNote.pushNoteUpdate → quickNoteWin.webContents.send）。
 * 小窗收到后从 db 重读该页。preload 内部仅在小窗存在时才真正下发，无小窗时 no-op。
 *
 * 仅主窗调用（小窗自身不需要往自己推）。在 bootstrap 中按 windowType 守卫。
 */
export function setupMainToQuickNotePush(): () => void {
  const utools = getUToolsApi();
  // 小窗（browser）/ 分离窗口不启动此推送。
  if (
    utools &&
    typeof utools.getWindowType === "function" &&
    utools.getWindowType() !== "main"
  ) {
    return () => {};
  }

  const push = (pageId: string) => {
    const api = (window as any).gooseQuickNote;
    if (api && typeof api.pushNoteUpdate === "function") {
      api.pushNoteUpdate(pageId);
    }
  };

  // 记录上次见到的各页 updatedAt，diff 出本次变化的页。
  let prev: Record<string, number> = {};
  const snapshot = (pages: Record<string, { updatedAt: number }>) => {
    const next: Record<string, number> = {};
    for (const id in pages) next[id] = pages[id].updatedAt;
    return next;
  };
  prev = snapshot(usePages.getState().pages as any);

  return usePages.subscribe((state) => {
    const pages = state.pages as Record<string, { updatedAt: number }>;
    for (const id in pages) {
      const u = pages[id].updatedAt;
      if (prev[id] !== u) {
        prev[id] = u;
        push(id);
      }
    }
  });
}
