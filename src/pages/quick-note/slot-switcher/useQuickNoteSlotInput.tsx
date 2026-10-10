import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { QUICKNOTE_SLOTS, type QuickNoteSlot } from "@/stores/useQuickNote";
import type { useQuickNoteSlotPreview } from "./useQuickNoteSlotPreview";

export function useQuickNoteSlotInput(
  input: ReturnType<typeof useQuickNoteSlotPreview>,
) {
  const {
    activeSlot,
    onChange,
    onRenameRequest,
    rootRef,
    scrubbingRef,
    previewSlotRef,
    activeSlotRef,
    pointerStartSlotRef,
    pointerMovedAcrossSlotsRef,
    setScrubbing,
    updatePreview,
    commitAndEnd,
    endScrubWithoutCommit,
    slotFromPoint,
  } = input;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) return;
    const idx = QUICKNOTE_SLOTS.indexOf(activeSlot);
    let targetSlot: QuickNoteSlot | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetSlot = QUICKNOTE_SLOTS[(idx + 1) % QUICKNOTE_SLOTS.length]!;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetSlot =
        QUICKNOTE_SLOTS[
          (idx - 1 + QUICKNOTE_SLOTS.length) % QUICKNOTE_SLOTS.length
        ]!;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetSlot = 1;
    } else if (e.key === "End") {
      e.preventDefault();
      targetSlot = 5;
    } else if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      targetSlot = Number(e.key) as QuickNoteSlot;
    }
    if (targetSlot === null) return;
    onChange(targetSlot, "switcher-keyboard");
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-slot="${targetSlot}"]`)
        ?.focus();
    });
  };

  const stopWindowScrubListeners = useRef<(() => void) | null>(null);

  const detachWindowScrubListeners = () => {
    stopWindowScrubListeners.current?.();
    stopWindowScrubListeners.current = null;
  };

  useEffect(() => () => detachWindowScrubListeners(), []);

  const onPointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    slot: QuickNoteSlot,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    detachWindowScrubListeners();
    scrubbingRef.current = true;
    pointerStartSlotRef.current = slot;
    pointerMovedAcrossSlotsRef.current = false;
    setScrubbing(true);
    updatePreview(slot);

    const onMove = (ev: PointerEvent) => {
      if (!scrubbingRef.current) return;
      const next = slotFromPoint(ev.clientX, ev.clientY);
      if (next != null) {
        if (next !== pointerStartSlotRef.current) {
          pointerMovedAcrossSlotsRef.current = true;
        }
        updatePreview(next);
      }
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
      const shouldRename =
        pointerStartSlotRef.current === activeSlotRef.current &&
        next === activeSlotRef.current &&
        !pointerMovedAcrossSlotsRef.current;
      detachWindowScrubListeners();
      if (shouldRename) {
        endScrubWithoutCommit();
        onRenameRequest(activeSlotRef.current);
      } else {
        commitAndEnd(next);
      }
      pointerStartSlotRef.current = null;
      pointerMovedAcrossSlotsRef.current = false;
    };

    const cancel = () => {
      detachWindowScrubListeners();
      endScrubWithoutCommit();
      pointerStartSlotRef.current = null;
      pointerMovedAcrossSlotsRef.current = false;
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
    // 「移走就生效」：拖动中指针离开切换器时提交当前预览槽
    if (!scrubbingRef.current) return;
    const slot = previewSlotRef.current ?? activeSlotRef.current;
    detachWindowScrubListeners();
    commitAndEnd(slot);
  };
  return {
    ...input,
    onKeyDown,
    stopWindowScrubListeners,
    detachWindowScrubListeners,
    onPointerDown,
    onRootPointerLeave,
  };
}
