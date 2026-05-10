import { useEffect, useRef, useState, useCallback } from "react";

export function useActiveHeading(
  scrollContainerRef: React.RefObject<HTMLDivElement | null> | undefined,
  headingIds: string[],
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleSetRef = useRef<Set<string>>(new Set());

  const findTopMost = useCallback(() => {
    const container = scrollContainerRef?.current;
    if (!container || headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    let topMostId: string | null = null;
    let topMostY = Infinity;

    for (const id of headingIds) {
      const el = container.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeY = rect.top - containerRect.top;
      // 元素在容器可视区域内或上方一点点也算
      if (relativeY <= 80 && relativeY < topMostY) {
        topMostY = relativeY;
        topMostId = id;
      }
    }

    setActiveId(topMostId);
  }, [scrollContainerRef, headingIds]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container || headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    visibleSetRef.current.clear();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-id");
          if (!id) continue;
          if (entry.isIntersecting) {
            visibleSetRef.current.add(id);
          } else {
            visibleSetRef.current.delete(id);
          }
        }
        findTopMost();
      },
      {
        root: container,
        rootMargin: "-40px 0px -60% 0px",
        threshold: 0,
      },
    );

    for (const id of headingIds) {
      const el = container.querySelector(`[data-id="${id}"]`);
      if (el) observerRef.current.observe(el);
    }

    // 初始计算
    findTopMost();

    return () => {
      observerRef.current?.disconnect();
    };
  }, [scrollContainerRef, headingIds, findTopMost]);

  // 同时监听滚动事件作为 fallback
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    const onScroll = () => {
      findTopMost();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [scrollContainerRef, findTopMost]);

  return activeId;
}
