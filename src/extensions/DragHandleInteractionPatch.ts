import { Extension } from "@tiptap/core";

const DRAG_HANDLE_SELECTOR = ".drag-handle";
const HOLD_TO_DRAG_DELAY_MS = 150;

function bridgeDragHandleClickToDocument(event: Event) {
  if (event.target !== window) return;

  const customEvent = event as CustomEvent<unknown>;
  document.dispatchEvent(
    new CustomEvent("drag-handle-click", {
      detail: customEvent.detail,
    }),
  );
}

function patchDragHandleGesture(handle: HTMLElement) {
  if (handle.dataset.dragGesturePatched === "1") {
    return () => {};
  }

  handle.dataset.dragGesturePatched = "1";

  let holdTimer: number | null = null;
  let pointerDown = false;
  let dragUnlocked = false;
  let activePointerId: number | null = null;
  let suppressNextClick = false;

  const clearHoldTimer = () => {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const resetToClickMode = () => {
    clearHoldTimer();
    pointerDown = false;
    dragUnlocked = false;
    activePointerId = null;
    suppressNextClick = false;
    handle.draggable = false;
    handle.dataset.dragMode = "click";
  };

  const unlockDragMode = () => {
    if (!pointerDown) return;
    dragUnlocked = true;
    handle.draggable = true;
    handle.dataset.dragMode = "drag";
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;

    pointerDown = true;
    dragUnlocked = false;
    activePointerId = event.pointerId;
    handle.draggable = false;
    handle.dataset.dragMode = "press";

    clearHoldTimer();
    holdTimer = window.setTimeout(() => {
      if (!pointerDown || activePointerId !== event.pointerId) return;
      unlockDragMode();
    }, HOLD_TO_DRAG_DELAY_MS);
  };

  const onPointerUpOrCancel = (event: PointerEvent) => {
    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    if (handle.dataset.dragMode === "dragging") {
      clearHoldTimer();
      pointerDown = false;
      activePointerId = null;
      return;
    }

    if (!dragUnlocked) {
      resetToClickMode();
      return;
    }

    suppressNextClick = true;
    window.setTimeout(() => {
      if (handle.dataset.dragMode !== "dragging") {
        resetToClickMode();
      }
    }, 0);
  };

  const onDragStart = (event: DragEvent) => {
    if (!dragUnlocked) {
      event.preventDefault();
      event.stopPropagation();
      resetToClickMode();
      return;
    }

    handle.dataset.dragMode = "dragging";
    suppressNextClick = false;
  };

  const onDragEnd = () => {
    resetToClickMode();
  };

  const onClick = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = false;
  };

  const onWindowBlur = () => {
    resetToClickMode();
  };

  resetToClickMode();

  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUpOrCancel, true);
  window.addEventListener("pointercancel", onPointerUpOrCancel, true);
  handle.addEventListener("dragstart", onDragStart);
  handle.addEventListener("dragend", onDragEnd);
  handle.addEventListener("click", onClick, true);
  window.addEventListener("blur", onWindowBlur);

  return () => {
    clearHoldTimer();
    handle.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUpOrCancel, true);
    window.removeEventListener("pointercancel", onPointerUpOrCancel, true);
    handle.removeEventListener("dragstart", onDragStart);
    handle.removeEventListener("dragend", onDragEnd);
    handle.removeEventListener("click", onClick, true);
    window.removeEventListener("blur", onWindowBlur);
    handle.draggable = false;
    handle.dataset.dragMode = "click";
    delete handle.dataset.dragGesturePatched;
  };
}

export const DragHandleInteractionPatch = Extension.create({
  name: "dragHandleInteractionPatch",

  onCreate() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let activeHandle: HTMLElement | null = null;
    let cleanupHandlePatch: (() => void) | null = null;

    const patchCurrentHandle = () => {
      const nextHandle = document.querySelector<HTMLElement>(DRAG_HANDLE_SELECTOR);
      if (nextHandle === activeHandle) return;

      cleanupHandlePatch?.();
      cleanupHandlePatch = null;
      activeHandle = nextHandle;

      if (activeHandle) {
        cleanupHandlePatch = patchDragHandleGesture(activeHandle);
      }
    };

    patchCurrentHandle();

    const observer = new MutationObserver(() => {
      patchCurrentHandle();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("drag-handle-click", bridgeDragHandleClickToDocument);

    this.storage.cleanup = () => {
      observer.disconnect();
      cleanupHandlePatch?.();
      cleanupHandlePatch = null;
      activeHandle = null;
      window.removeEventListener(
        "drag-handle-click",
        bridgeDragHandleClickToDocument,
      );
    };
  },

  onDestroy() {
    const cleanup = this.storage.cleanup as (() => void) | undefined;
    cleanup?.();
  },

  addStorage() {
    return {
      cleanup: undefined as (() => void) | undefined,
    };
  },
});
