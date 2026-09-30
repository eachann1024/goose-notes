import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import { FIXED_CLOSE_SHORTCUT } from "@/lib/fixed-app-shortcuts";
import { matchShortcut } from "@/lib/shortcut-match";

export const OPEN_DIALOG_SELECTOR =
  'dialog[open], :is([role="dialog"], [role="alertdialog"]):not([data-state="closed"]):not([hidden]):not([aria-hidden="true"])';
export const OPEN_ESCAPE_LAYER_SELECTOR = `${OPEN_DIALOG_SELECTOR}, [role="menu"]:not([data-state="closed"]):not([hidden]), [data-goose-floating-content][data-state="open"]`;
export const OPEN_TOAST_SELECTOR = '[data-sonner-toast]:not([data-removed="true"])';

/** Capture only the notification layer; let editor/IME/dialog handlers consume Escape first.
 * A snapshot prevents a synchronously removed dialog from exposing the note to the same event.
 */
export function registerEscapeClose(options: {
  document: Document;
  window: Window;
  enabled: () => boolean;
  dismissToasts: () => void;
  closeContent: () => void;
}): () => void {
  const { document: root, window: host } = options;
  const blocked = new WeakSet<KeyboardEvent>();
  let disposed = false;
  const capture = (event: KeyboardEvent) => {
    if (!matchShortcut(event, FIXED_CLOSE_SHORTCUT)) return;
    const target = event.target as HTMLElement | null;
    if (!options.enabled() || event.defaultPrevented || target?.closest?.('[data-shortcut-recorder]')) {
      blocked.add(event);
      return;
    }
    if (isImeKeyboardEvent(event)) {
      blocked.add(event);
      // HeroUI checks isComposing but not Chromium's legacy 229 marker.
      // Keep native IME cancellation, while preventing dialog dismissal.
      if (root.querySelector(OPEN_ESCAPE_LAYER_SELECTOR)) event.stopImmediatePropagation();
      return;
    }
    if (event.repeat) {
      blocked.add(event);
      event.stopImmediatePropagation(); // Holding Escape must not peel off more layers.
      return;
    }
    if (root.querySelector(OPEN_TOAST_SELECTOR)) {
      blocked.add(event);
      event.preventDefault();
      event.stopImmediatePropagation();
      options.dismissToasts();
      return;
    }
    // closeAllOverlays dispatches to document to dismiss UI, never to close a note.
    if (event.target === root || root.querySelector(OPEN_ESCAPE_LAYER_SELECTOR)) blocked.add(event);
  };
  const bubble = (event: KeyboardEvent) => {
    if (!matchShortcut(event, FIXED_CLOSE_SHORTCUT) || blocked.has(event)) return;
    // Window listeners (e.g. fullscreen AI) must finish before the fallback runs.
    queueMicrotask(() => {
      if (disposed || event.defaultPrevented || isImeKeyboardEvent(event) || event.repeat || !options.enabled()) return;
      event.preventDefault();
      options.closeContent();
    });
  };
  host.addEventListener('keydown', capture, true);
  host.addEventListener('keydown', bubble);
  return () => {
    disposed = true;
    host.removeEventListener('keydown', capture, true);
    host.removeEventListener('keydown', bubble);
  };
}
