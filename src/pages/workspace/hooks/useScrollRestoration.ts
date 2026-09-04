import { useEffect, useRef, type RefObject } from "react";

/** 按 page 记住滚动位置，跨 pane 实例共享，避免切格时用错容器。 */
const pageScrollPositions: Record<string, number> = {};

export function useScrollRestoration(
  pageId: string | null | undefined,
  externalRef?: RefObject<HTMLDivElement | null>,
) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalRef ?? internalRef;

  // 每个容器自己上报：滚动中、卸监听（blur / 换页 / unmount）时写入对应 pageId。
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !pageId) return;

    const handleScroll = () => {
      pageScrollPositions[pageId] = container.scrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      pageScrollPositions[pageId] = container.scrollTop;
      container.removeEventListener("scroll", handleScroll);
    };
  }, [pageId, scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!pageId || !container) return;

    const savedTop = pageScrollPositions[pageId];
    const targetTop = typeof savedTop === "number" ? savedTop : 0;

    const restoreScroll = () => {
      const currentContainer = scrollContainerRef.current;
      if (!currentContainer) return;
      currentContainer.scrollTop = targetTop;
    };

    requestAnimationFrame(restoreScroll);
    const timer = window.setTimeout(restoreScroll, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pageId, scrollContainerRef]);

  return scrollContainerRef;
}
