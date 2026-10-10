import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { editorScaleNow } from "./artifactMeasure";
import type { ArtifactTransformState } from "./useArtifactTransform";
export function useArtifactInteractions({
  viewportRef,
  transformRef,
  isZoomedIn,
  applyTransform,
}: ArtifactTransformState) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [dragging, setDragging] = useState(false);
  // 仅在已放大时拦截滚轮：平移查看细节，不缩放，也不抢走页面滚动
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isZoomedIn) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const prev = transformRef.current;
      const zoom = editorScaleNow();
      applyTransform({
        scale: prev.scale,
        x: prev.x - event.deltaX / zoom,
        y: prev.y - event.deltaY / zoom,
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [applyTransform, isZoomedIn]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isZoomedIn) return;
    if (event.button !== 0) return;
    // 控件按钮不进入拖拽
    if ((event.target as HTMLElement | null)?.closest("button")) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
    setDragging(true);
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const zoom = editorScaleNow();
    applyTransform({
      scale: transformRef.current.scale,
      x: drag.originX + (event.clientX - drag.startX) / zoom,
      y: drag.originY + (event.clientY - drag.startY) / zoom,
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return { dragging, onPointerDown, onPointerMove, endDrag };
}
