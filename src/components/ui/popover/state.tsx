import * as React from "react";
import { autoUpdate, flip, offset, shift, safePolygon, size, useClick, useDismiss, useFloating, useInteractions, useHover, useRole, useTransitionStatus, type Placement } from "@floating-ui/react";
import { NOTEBOOK_MENU_CLOSE_MS, NOTEBOOK_MENU_OPEN_MS, FLOATING_MENU_CLOSE_MS, FLOATING_MENU_OPEN_MS, type FloatingMotionMode } from "../floating-menu-motion";

export type PopoverProps = React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  variant?: "notebook";
  openOnHover?: boolean;
}>;
function usePopoverState({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  modal = false,
  variant,
  openOnHover = false,
}: PopoverProps) {
  const [local, setLocal] = React.useState(defaultOpen);
  const [placement, setPlacement] = React.useState<Placement>("bottom");
  const [spacing, setSpacing] = React.useState({
    mainAxis: 6,
    crossAxis: 0,
    padding: 8,
  });
  const open = controlled ?? local;
  // Programmatic/keyboard opens are immediate; a pointer explicitly opts into motion.
  const keyboard = React.useRef(true);
  const [reducedMotion, setReducedMotion] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const outside = React.useRef<{
    onInteractOutside?: (event: Event) => void;
    onPointerDownOutside?: (event: Event) => void;
  }>({});
  const floating = useFloating({
    open,
    transform: false,
    onOpenChange: (next, event) => {
      if (event) keyboard.current = event.type === "keydown" || (event.type === "click" && (event as MouseEvent).detail === 0);
      if (controlled === undefined) setLocal(next);
      onOpenChange?.(next);
    },
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(spacing),
      flip({ padding: spacing.padding }),
      shift({ padding: spacing.padding }),
      size({
        padding: spacing.padding,
        apply({ availableHeight, rects, elements }) {
          elements.floating.style.setProperty(
            "--goose-popover-available-height",
            `${availableHeight}px`,
          );
          elements.floating.style.setProperty(
            "--goose-popover-trigger-width",
            `${rects.reference.width}px`,
          );
        },
      }),
    ],
  });
  const presence = useTransitionStatus(floating.context, {
    duration: {
      open: variant === "notebook" ? NOTEBOOK_MENU_OPEN_MS : FLOATING_MENU_OPEN_MS,
      close: keyboard.current ? 0 : variant === "notebook" ? NOTEBOOK_MENU_CLOSE_MS : FLOATING_MENU_CLOSE_MS,
    },
  });
  React.useEffect(() => {
    if (!presence.isMounted) keyboard.current = true;
  }, [presence.isMounted]);
  const hover = useHover(floating.context, {
    enabled: openOnHover,
    mouseOnly: true,
    move: false,
    delay: { close: 160 },
    handleClose: safePolygon({ buffer: 4, requireIntent: false }),
  });
  const click = useClick(floating.context);
  const dismiss = useDismiss(floating.context, {
    outsidePress: (native) => {
      const event = new Event(native.type, { cancelable: true });
      outside.current.onPointerDownOutside?.(event);
      outside.current.onInteractOutside?.(event);
      return !event.defaultPrevented;
    },
  });
  const role = useRole(floating.context, { role: "dialog" });
  return {
    ...floating,
    ...presence,
    keyboard,
    motionMode: (keyboard.current
      ? "instant"
      : reducedMotion
        ? "reduced"
        : "full") as FloatingMotionMode,
    ...useInteractions([hover, click, dismiss, role]),
    open,
    modal,
    variant,
    setPlacement,
    setSpacing,
    outside,
  };
}
export const PopoverState = React.createContext<ReturnType<
  typeof usePopoverState
> | null>(null);
export function usePopoverContext() {
  const state = React.useContext(PopoverState);
  if (!state) throw new Error("Popover components require Popover");
  return state;
}
export function Popover({ children, ...props }: PopoverProps) {
  const state = usePopoverState(props);
  return (
    <PopoverState.Provider value={state}>{children}</PopoverState.Provider>
  );
}
