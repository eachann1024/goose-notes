import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Menu session only: preview uses the owning settings value and setter. */
export function useFontSelectionPreview(
  value: string | null,
  onChange: (value: string | null) => void,
) {
  const [open, setOpen] = useState(false);
  const current = useRef({ value, onChange });
  useLayoutEffect(() => {
    current.current = { value, onChange };
  }, [value, onChange]);
  const session = useRef<{
    original: string | null;
    confirmed: boolean;
    previewed: boolean;
  } | null>(null);
  const keyboardNavigation = useRef(false);
  const removeListeners = useRef<(() => void) | null>(null);
  const removeConfirmationKeyUp = useRef<(() => void) | null>(null);
  const confirmFont = useCallback((font: string | null) => {
    if (!session.current) return;
    session.current.confirmed = true;
    // An action must confirm even if selection already equals the preview.
    current.current.onChange(font);
    session.current = null;
    keyboardNavigation.current = false;
    removeConfirmationKeyUp.current?.();
    setOpen(false);
  }, []);

  // React Aria filters capture props on Popover. Attach to its real DOM node,
  // so navigation is observed before the menu moves focus to the next item.
  const contentRef = useCallback(
    (node: HTMLElement | null) => {
      removeListeners.current?.();
      removeListeners.current = null;
      if (!node) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          const target = event.target;
          const item =
            target instanceof HTMLElement
              ? target.closest<HTMLElement>("[data-font-preview]")
              : null;
          if (
            !item ||
            !node.contains(item) ||
            item.getAttribute("aria-disabled") === "true"
          )
            return;
          // Own this key pair: closing before keyup can send that release to the
          // restored trigger and reopen it through React Aria's press handling.
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.repeat) return;
          removeConfirmationKeyUp.current?.();
          const font = item.dataset.fontPreview || null;
          const key = event.key;
          const onKeyUp = (release: KeyboardEvent) => {
            if (release.key !== key) return;
            release.preventDefault();
            release.stopImmediatePropagation();
            cleanup();
            confirmFont(font);
          };
          const cleanup = () => {
            document.removeEventListener("keyup", onKeyUp, true);
            window.removeEventListener("blur", cleanup);
            removeConfirmationKeyUp.current = null;
          };
          document.addEventListener("keyup", onKeyUp, true);
          window.addEventListener("blur", cleanup);
          removeConfirmationKeyUp.current = cleanup;
          return;
        }
        keyboardNavigation.current = [
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key);
      };
      const onPointerMove = () => {
        keyboardNavigation.current = false;
      };
      const onFocus = (event: FocusEvent) => {
        if (!keyboardNavigation.current || !session.current) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest<HTMLElement>("[data-font-preview]");
        if (!item || !node.contains(item)) return;
        keyboardNavigation.current = false;
        session.current.previewed = true;
        current.current.onChange(item.dataset.fontPreview || null);
      };
      node.addEventListener("keydown", onKeyDown, true);
      node.addEventListener("focusin", onFocus, true);
      node.addEventListener("pointermove", onPointerMove, true);
      node.addEventListener("pointerdown", onPointerMove, true);
      removeListeners.current = () => {
        node.removeEventListener("keydown", onKeyDown, true);
        node.removeEventListener("focusin", onFocus, true);
        node.removeEventListener("pointermove", onPointerMove, true);
        node.removeEventListener("pointerdown", onPointerMove, true);
      };
    },
    [confirmFont],
  );

  const cancelSession = () => {
    removeConfirmationKeyUp.current?.();
    const previous = session.current;
    session.current = null;
    keyboardNavigation.current = false;
    if (previous?.previewed && !previous.confirmed) {
      current.current.onChange(previous.original);
    }
  };
  useEffect(
    () => () => {
      removeListeners.current?.();
      removeConfirmationKeyUp.current?.();
      const previous = session.current;
      session.current = null;
      if (previous?.previewed && !previous.confirmed) {
        current.current.onChange(previous.original);
      }
    },
    [],
  );

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !session.current) {
      session.current = {
        original: current.current.value,
        confirmed: false,
        previewed: false,
      };
      keyboardNavigation.current = false;
    } else if (!nextOpen) {
      cancelSession();
    }
    setOpen(nextOpen);
  };

  return { open, onOpenChange, contentRef, confirmFont };
}
