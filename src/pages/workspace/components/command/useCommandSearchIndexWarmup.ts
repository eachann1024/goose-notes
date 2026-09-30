import { useEffect } from "react";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { syncSearchCatalog } from "./pageSearchCatalog";

/**
 * 主窗挂载后在空闲时预热搜索目录/倒排索引，使 ⌘K 打开时不必现抽全文。
 * 只订 pages / notebooks 引用变化，不驱动 CommandPalette 重渲染。
 */
export function useCommandSearchIndexWarmup(): void {
  useEffect(() => {
    let idleId = 0;
    let timeoutId = 0;

    const cancel = () => {
      if (idleId !== 0 && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
        idleId = 0;
      }
      if (timeoutId !== 0) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
    };

    const run = () => {
      syncSearchCatalog(
        usePages.getState().pages,
        useNotebooks.getState().notebooks,
      );
    };

    const schedule = () => {
      cancel();
      if (typeof requestIdleCallback === "function") {
        idleId = requestIdleCallback(run, { timeout: 400 });
      } else {
        timeoutId = window.setTimeout(run, 32);
      }
    };

    schedule();
    const unsubPages = usePages.subscribe((state, prev) => {
      if (state.pages !== prev.pages) schedule();
    });
    const unsubNotebooks = useNotebooks.subscribe((state, prev) => {
      if (state.notebooks !== prev.notebooks) schedule();
    });
    return () => {
      cancel();
      unsubPages();
      unsubNotebooks();
    };
  }, []);
}
