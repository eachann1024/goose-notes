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
}

export function useSidebarResize({
  disableResize = false,
  defaultWidth = SIDEBAR_DEFAULT_WIDTH,
  maxWidth = SIDEBAR_MAX_WIDTH,
}: UseSidebarResizeOptions = {}) {
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

  const startResizing = (startX: number) => {
    if (disableResize) return;
    activeCleanupRef.current?.();
    activeCleanupRef.current = null;
    setIsResizing(true);

    const startWidth = width;

    const updateWidth = (nextClientX: number) => {
      const newWidth = startWidth + nextClientX - startX;
      setWidth(clampSidebarResizeWidth(newWidth, maxWidth));
    };

    const onMouseMove = (event: MouseEvent) => {
      updateWidth(event.clientX);
    };

    const onPointerMove = (event: PointerEvent) => {
      updateWidth(event.clientX);
    };

    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopResizing);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", stopResizing);
      document.removeEventListener("pointercancel", stopResizing);
      window.removeEventListener("blur", stopResizing);
      document.body.style.cursor = "";
      if (activeCleanupRef.current === cleanup) activeCleanupRef.current = null;
    };
    const stopResizing = () => {
      cleanup();
      setIsResizing(false);
    };

    activeCleanupRef.current = cleanup;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", stopResizing);
    document.addEventListener("pointercancel", stopResizing);
    window.addEventListener("blur", stopResizing);
    document.body.style.cursor = "col-resize";
  };

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    if (disableResize || event.button !== 0) return;
    event.preventDefault();
    startResizing(event.clientX);
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disableResize || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startResizing(event.clientX);
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
    handleResizeMouseDown,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
}
