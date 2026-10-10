import { useEffect, useRef, useState } from "react";
import { type QuickNoteSlot } from "@/stores/useQuickNote";
import { type QuickNoteSlotSwitcherProps, isQuickNoteSlot } from "./shared";

export function useQuickNoteSlotPreview({
  activeSlot,
  occupiedSlots,
  slotNames,
  onChange,
  onPreviewChange,
  onRenameRequest,
}: QuickNoteSlotSwitcherProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const scrubbingRef = useRef(false);

  const previewSlotRef = useRef<QuickNoteSlot | null>(null);

  const onChangeRef = useRef(onChange);

  const onPreviewChangeRef = useRef(onPreviewChange);

  const activeSlotRef = useRef(activeSlot);

  const pointerStartSlotRef = useRef<QuickNoteSlot | null>(null);

  const pointerMovedAcrossSlotsRef = useRef(false);

  const [scrubbing, setScrubbing] = useState(false);

  const [previewSlot, setPreviewSlot] = useState<QuickNoteSlot | null>(null);

  const visualSlot = previewSlot ?? activeSlot;

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

  const slotFromPoint = (
    clientX: number,
    clientY: number,
  ): QuickNoteSlot | null => {
    const root = rootRef.current;
    if (!root) return null;

    // 仍在胶囊水平范围内时，按 X 投影到最近按钮（快速横滑不必严格命中圆心）
    const rootRect = root.getBoundingClientRect();
    const insideY =
      clientY >= rootRect.top - 8 && clientY <= rootRect.bottom + 8;
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
  return {
    activeSlot,
    occupiedSlots,
    slotNames,
    onChange,
    onPreviewChange,
    onRenameRequest,
    rootRef,
    scrubbingRef,
    previewSlotRef,
    onChangeRef,
    onPreviewChangeRef,
    activeSlotRef,
    pointerStartSlotRef,
    pointerMovedAcrossSlotsRef,
    scrubbing,
    setScrubbing,
    previewSlot,
    setPreviewSlot,
    visualSlot,
    updatePreview,
    commitAndEnd,
    endScrubWithoutCommit,
    slotFromPoint,
  };
}
