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

    const anchorOffset = 30;
    let nearestPassedId: string | null = null;
    let nearestPassedY = -Infinity;
    let nearestUpcomingId: string | null = null;
    let nearestUpcomingY = Infinity;

    const containerRect = container.getBoundingClientRect();

    for (const id of headingIds) {
      const el = container.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const relativeY = rect.top - containerRect.top;

      // 优先选“已经到达顶部锚点”的最近标题（支持一级/二级/三级大纲）
      if (relativeY <= anchorOffset && relativeY > nearestPassedY) {
        nearestPassedY = relativeY;
        nearestPassedId = id;
        continue;
      }

      // 如果还没到任何标题，则取离锚点最近的下一个标题
      if (relativeY > anchorOffset && relativeY < nearestUpcomingY) {
        nearestUpcomingY = relativeY;
        nearestUpcomingId = id;
      }
    }

    setActiveId(nearestPassedId ?? nearestUpcomingId);
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
