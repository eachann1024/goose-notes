import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  QUICKNOTE_SLOTS,
  type QuickNoteSlot,
} from "@/stores/useQuickNote";

interface QuickNoteSlotSwitcherProps {
  activeSlot: QuickNoteSlot;
  /** 正式切换（点击 / 键盘 / 拖动松手或移走后提交） */
  onChange: (slot: QuickNoteSlot, source: "pointer" | "keyboard") => void;
  /**
   * 按住拖动时的临时预览槽位；null 表示结束预览、回到 activeSlot。
   * 未传入时退化为即时 onChange（无预览态）。
   */
  onPreviewChange?: (slot: QuickNoteSlot | null) => void;
}

function isQuickNoteSlot(value: number): value is QuickNoteSlot {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * 标题栏居中的 1–5 便签切换器。
 * 默认只居中显示当前数字；hover / focus-within / 拖动时展开全部槽位。
 * 按住拖动可快速预览各槽内容，松开或移出后提交选中。
 */
export function QuickNoteSlotSwitcher({
  activeSlot,
  onChange,
  onPreviewChange,
}: QuickNoteSlotSwitcherProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const previewSlotRef = useRef<QuickNoteSlot | null>(null);
  const onChangeRef = useRef(onChange);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const activeSlotRef = useRef(activeSlot);

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [previewSlot, setPreviewSlot] = useState<QuickNoteSlot | null>(null);

  const visualSlot = previewSlot ?? activeSlot;
  const expanded = hovered || focused || scrubbing;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onPreviewChangeRef.current = onPreviewChange;
  }, [onPreviewChange]);
  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  const updatePreview = (slot: QuickNoteSlot) => {
    if (previewSlotRef.current === slot) return;
    previewSlotRef.current = slot;
    setPreviewSlot(slot);
    onPreviewChangeRef.current?.(slot);
  };

  const commitAndEnd = (slot: QuickNoteSlot) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    previewSlotRef.current = null;
    setScrubbing(false);
    setPreviewSlot(null);
    onPreviewChangeRef.current?.(null);
    onChangeRef.current(slot, "pointer");
  };

  const endScrubWithoutCommit = () => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    previewSlotRef.current = null;
    setScrubbing(false);
    setPreviewSlot(null);
    onPreviewChangeRef.current?.(null);
  };

  const slotFromPoint = (clientX: number, clientY: number): QuickNoteSlot | null => {
    const root = rootRef.current;
    if (!root) return null;

    // 仍在胶囊水平范围内时，按 X 投影到最近按钮（快速横滑不必严格命中圆心）
    const rootRect = root.getBoundingClientRect();
    const insideY = clientY >= rootRect.top - 8 && clientY <= rootRect.bottom + 8;
    const insideX = clientX >= rootRect.left && clientX <= rootRect.right;
    if (insideY && insideX) {
      const buttons = root.querySelectorAll<HTMLElement>("[data-slot]");
      let best: QuickNoteSlot | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const btn of buttons) {
        const n = Number(btn.dataset.slot);
        if (!isQuickNoteSlot(n)) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.width <= 0) continue;
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);
        if (dist < bestDist) {
          bestDist = dist;
          best = n;
        }
      }
      if (best != null) return best;
    }

    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(clientX, clientY)
        : [document.elementFromPoint(clientX, clientY)];
    for (const node of stack) {
      if (!(node instanceof Element)) continue;
      const btn = node.closest("[data-slot]");
      if (!(btn instanceof HTMLElement) || !root.contains(btn)) continue;
      const n = Number(btn.dataset.slot);
      if (isQuickNoteSlot(n)) return n;
    }
    return null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) return;
    const idx = QUICKNOTE_SLOTS.indexOf(activeSlot);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(
        QUICKNOTE_SLOTS[(idx + 1) % QUICKNOTE_SLOTS.length]!,
        "keyboard",
      );
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(
        QUICKNOTE_SLOTS[(idx - 1 + QUICKNOTE_SLOTS.length) % QUICKNOTE_SLOTS.length]!,
        "keyboard",
      );
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      onChange(1, "keyboard");
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      onChange(5, "keyboard");
      return;
    }
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      onChange(Number(e.key) as QuickNoteSlot, "keyboard");
    }
  };

  const stopWindowScrubListeners = useRef<(() => void) | null>(null);

  const detachWindowScrubListeners = () => {
    stopWindowScrubListeners.current?.();
    stopWindowScrubListeners.current = null;
  };

  useEffect(() => () => detachWindowScrubListeners(), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, slot: QuickNoteSlot) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    detachWindowScrubListeners();
    scrubbingRef.current = true;
    setScrubbing(true);
    updatePreview(slot);

    const onMove = (ev: PointerEvent) => {
      if (!scrubbingRef.current) return;
      const next = slotFromPoint(ev.clientX, ev.clientY);
      if (next != null) updatePreview(next);
    };

    const finish = (ev: PointerEvent) => {
      if (!scrubbingRef.current) {
        detachWindowScrubListeners();
        return;
      }
      const next =
        slotFromPoint(ev.clientX, ev.clientY) ??
        previewSlotRef.current ??
        activeSlotRef.current;
      detachWindowScrubListeners();
      commitAndEnd(next);
    };

    const cancel = () => {
      detachWindowScrubListeners();
      endScrubWithoutCommit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    stopWindowScrubListeners.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  };

  const onRootPointerLeave = () => {
    setHovered(false);
    // 「移走就生效」：拖动中指针离开切换器时提交当前预览槽
    if (!scrubbingRef.current) return;
    const slot = previewSlotRef.current ?? activeSlotRef.current;
    detachWindowScrubListeners();
    commitAndEnd(slot);
  };

  return (
    <div
      ref={rootRef}
      className="quicknote-slot-switcher"
      data-expanded={expanded ? "true" : "false"}
      data-scrubbing={scrubbing ? "true" : "false"}
      role="radiogroup"
      aria-label="切换便签"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onRootPointerLeave}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onKeyDown={onKeyDown}
    >
      {QUICKNOTE_SLOTS.map((slot) => {
        const active = slot === visualSlot;
        return (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`便签 ${slot}`}
            tabIndex={active ? 0 : -1}
            data-slot={slot}
            data-active={active ? "true" : "false"}
            className="quicknote-slot-btn"
            onPointerDown={(e) => onPointerDown(e, slot)}
            // 选择由 pointer 提交；避免 click 与拖动松手重复触发
            onClick={(e) => e.preventDefault()}
          >
            <span className="quicknote-slot-btn-label">{slot}</span>
          </button>
        );
      })}
    </div>
  );
}
