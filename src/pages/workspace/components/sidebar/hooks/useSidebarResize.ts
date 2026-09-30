import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const SIDEBAR_MIN_WIDTH = 268;
const SIDEBAR_DEFAULT_WIDTH = 288;
export const SIDEBAR_MAX_WIDTH = 480;

export function resolveSidebarWidth(
  saved: string | null,
  defaultWidth = SIDEBAR_DEFAULT_WIDTH,
) {
  const value = saved?.trim() ? Number(saved) : NaN;
  return Number.isFinite(value) && value > 0
    ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, value))
    : defaultWidth;
}

export function resolveSidebarOverlayWidth(width: number, viewportWidth: number) {
  return Math.min(width, Math.max(0, viewportWidth - 56));
}

export function clampSidebarResizeWidth(width: number, maxWidth = SIDEBAR_MAX_WIDTH) {
  return Math.max(Math.min(SIDEBAR_MIN_WIDTH, maxWidth), Math.min(maxWidth, width));
}

export function resolveSidebarKeyboardWidth(
  width: number,
  key: string,
  disabled = false,
  maxWidth = SIDEBAR_MAX_WIDTH,
): number | null {
  if (disabled) return null;
  if (key === "Home") return Math.min(SIDEBAR_MIN_WIDTH, maxWidth);
  if (key === "End") return maxWidth;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const currentWidth = clampSidebarResizeWidth(width, maxWidth);
  return clampSidebarResizeWidth(
    currentWidth + (key === "ArrowLeft" ? -16 : 16),
    maxWidth,
  );
}

interface UseSidebarResizeOptions {
  disableResize?: boolean;
  defaultWidth?: number;
  maxWidth?: number;
  onWidthPreview: (width: number) => void;
}

export function useSidebarResize({
  disableResize = false,
  defaultWidth = SIDEBAR_DEFAULT_WIDTH,
  maxWidth = SIDEBAR_MAX_WIDTH,
  onWidthPreview,
}: UseSidebarResizeOptions) {
  const [preferredWidth, setWidth] = useState(() => {
    try {
      return resolveSidebarWidth(localStorage.getItem("sidebar-width"), defaultWidth);
    } catch {
      return defaultWidth;
    }
  });
  // 窗口只限制显示宽度，不覆盖用户保存的宽度偏好。
  const minWidth = Math.min(SIDEBAR_MIN_WIDTH, maxWidth);
  const width = clampSidebarResizeWidth(preferredWidth, maxWidth);
  const [isResizing, setIsResizing] = useState(false);
  const activeCleanupRef = useRef<(() => void) | null>(null);
  const activeStopRef = useRef<(() => void) | null>(null);
  const previewRef = useRef(onWidthPreview);

  useLayoutEffect(() => {
    previewRef.current = onWidthPreview;
    // 窗口尺寸或侧栏模式在拖动中变化时，结束当前手势。
    activeStopRef.current?.();
  }, [disableResize, maxWidth, onWidthPreview]);

  useEffect(
    () => () => {
      activeCleanupRef.current?.();
      activeCleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("sidebar-width", String(preferredWidth));
      } catch {
        // Width is still usable for this session when storage is unavailable.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [preferredWidth]);

  const startResizing = (startX: number, pointerId: number) => {
    if (disableResize || activeCleanupRef.current) return;
    setIsResizing(true);

    const startWidth = width;
    let pendingWidth = startWidth;
    let frame: number | null = null;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    // 高频移动只写布局变量；整棵侧栏仅在手势开始和结束时更新 React。
    const flushPreview = () => {
      frame = null;
      previewRef.current(pendingWidth);
    };
    const updateWidth = (clientX: number) => {
      pendingWidth = clampSidebarResizeWidth(startWidth + clientX - startX, maxWidth);
      if (frame === null) frame = requestAnimationFrame(flushPreview);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId === pointerId) updateWidth(event.clientX);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      updateWidth(event.clientX);
      stopResizing();
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) stopResizing();
    };

    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", stopResizing);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      activeCleanupRef.current = null;
      activeStopRef.current = null;
    };
    const stopResizing = () => {
      if (!active) return;
      cleanup();
      flushPreview();
      setWidth(pendingWidth);
      setIsResizing(false);
    };

    activeCleanupRef.current = cleanup;
    activeStopRef.current = stopResizing;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disableResize || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startResizing(event.clientX, event.pointerId);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const nextWidth = resolveSidebarKeyboardWidth(width, event.key, disableResize, maxWidth);
    if (nextWidth === null) return;
    event.preventDefault();
    event.stopPropagation();
    setWidth(nextWidth);
  };

  return {
    width,
    minWidth,
    maxWidth,
    isResizing,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
}
