/**
 * 持久化 AI 面板宽度（至少 320px，展示上限由可用空间决定）
 */
import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "goose-note-ai-panel-width";
/** 用户拖拽与持久化的合法区间（展示宽度可能因父级极窄而低于 MIN） */
export const PANEL_WIDTH_MIN = 320;
const MIN_WIDTH = PANEL_WIDTH_MIN;
const DEFAULT_WIDTH = 360;

function clamp(v: number) {
  return Number.isFinite(v) ? Math.max(MIN_WIDTH, v) : DEFAULT_WIDTH;
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) return clamp(n);
    }
  } catch {}
  return DEFAULT_WIDTH;
}

export function usePanelWidth() {
  const [width, setWidth] = useState<number>(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);

  const setAndPersist = useCallback((w: number) => {
    const clamped = clamp(w);
    setWidth(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const beginDrag = useCallback(
    (clientX: number, displayedWidth: number) => {
      if (isDragging.current) return;
      isDragging.current = true;
      setIsResizing(true);
      startX.current = clientX;
      // 从当前展示宽度起算：stored 可能大于父级可用宽度，否则要拖很久才有反馈
      startWidth.current = displayedWidth;
      document.body.style.cursor = "col-resize";

      const applyDelta = (nextClientX: number) => {
        if (!isDragging.current) return;
        const delta = startX.current - nextClientX;
        setWidth(clamp(startWidth.current + delta));
      };

      const onMouseMove = (ev: MouseEvent) => applyDelta(ev.clientX);
      const onPointerMove = (ev: PointerEvent) => applyDelta(ev.clientX);

      const endDrag = (nextClientX: number) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        const delta = startX.current - nextClientX;
        setAndPersist(startWidth.current + delta);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      const onMouseUp = (ev: MouseEvent) => endDrag(ev.clientX);
      const onPointerUp = (ev: PointerEvent) => endDrag(ev.clientX);

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [setAndPersist],
  );

  const onDragHandleMouseDown = useCallback(
    (e: React.MouseEvent, displayedWidth: number) => {
      e.preventDefault();
      beginDrag(e.clientX, displayedWidth);
    },
    [beginDrag],
  );

  const onDragHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, displayedWidth: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      beginDrag(e.clientX, displayedWidth);
    },
    [beginDrag],
  );

  return {
    width,
    isResizing,
    setWidth: setAndPersist,
    onDragHandleMouseDown,
    onDragHandlePointerDown,
  };
}
