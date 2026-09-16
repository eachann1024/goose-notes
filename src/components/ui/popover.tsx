import * as React from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStatus,
  type Placement,
} from "@floating-ui/react";
import { useAnimate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";
import {
  FLOATING_MENU_CLOSE_MS,
  FLOATING_MENU_OPEN_MS,
  floatingMenuMotionStyle,
  type FloatingMotionMode,
} from "./floating-menu-motion";

type PopoverProps = React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}>;
function usePopoverState({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  modal = false,
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
  const reducedMotion = useReducedMotion();
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
      open: FLOATING_MENU_OPEN_MS,
      close: keyboard.current ? 0 : FLOATING_MENU_CLOSE_MS,
    },
  });
  React.useEffect(() => {
    if (!presence.isMounted) keyboard.current = true;
  }, [presence.isMounted]);
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
    ...useInteractions([click, dismiss, role]),
    open,
    modal,
    setPlacement,
    setSpacing,
    outside,
  };
}
const PopoverState = React.createContext<ReturnType<
  typeof usePopoverState
> | null>(null);
function usePopoverContext() {
  const state = React.useContext(PopoverState);
  if (!state) throw new Error("Popover components require Popover");
  return state;
}
function Popover({ children, ...props }: PopoverProps) {
  const state = usePopoverState(props);
  return (
    <PopoverState.Provider value={state}>{children}</PopoverState.Provider>
  );
}
const PopoverTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, forwardedRef) => {
  const state = usePopoverContext();
  const ref = useMergeRefs([forwardedRef, state.refs.setReference]);
  const injected = {
    ...state.getReferenceProps({
      ...props,
      onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => {
        state.keyboard.current = true;
        props.onKeyDownCapture?.(event);
      },
      onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
        state.keyboard.current = false;
        props.onPointerDownCapture?.(event);
      },
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        if (!state.open) state.keyboard.current = false;
        props.onPointerEnter?.(event);
      },
    }),
    ref,
    "data-state": state.open ? "open" : "closed",
    "data-present": state.isMounted ? "true" : "false",
    "data-motion": state.motionMode,
  };
  return asChild && React.isValidElement(children) ? (
    <TriggerChild
      child={children as React.ReactElement<React.HTMLAttributes<HTMLElement>>}
      injected={injected}
    />
  ) : (
    <button
      {...injected}
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
    >
      {children}
    </button>
  );
});
const PopoverAnchor = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, forwardedRef) => {
  const state = usePopoverContext();
  const ref = useMergeRefs([forwardedRef, state.refs.setPositionReference]);
  return asChild && React.isValidElement(children) ? (
    <TriggerChild
      child={children as React.ReactElement<React.HTMLAttributes<HTMLElement>>}
      injected={{ ...props, ref }}
    />
  ) : (
    <div {...props} ref={ref as React.Ref<HTMLDivElement>}>
      {children}
    </div>
  );
});
type PopoverContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  container?: HTMLElement | null;
  editorContext?: boolean;
  forceMount?: boolean;
  animation?: "fade" | "reveal";
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  onPointerDownOutside?: (event: Event) => void;
};
const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      className,
      side = "bottom",
      align = "center",
      sideOffset = 6,
      alignOffset = 0,
      collisionPadding = 8,
      container,
      editorContext,
      children,
      forceMount,
      animation = "fade",
      onOpenAutoFocus,
      onCloseAutoFocus,
      onInteractOutside,
      onPointerDownOutside,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const state = usePopoverContext();
    const [scope, animate] = useAnimate<HTMLDivElement>();
    const [mountedNode, setMountedNode] = React.useState<HTMLDivElement | null>(null);
    const ref = useMergeRefs([
      forwardedRef,
      state.refs.setFloating,
      scope,
      setMountedNode,
    ]);
    const actualSide = state.placement.split("-")[0];
    const collapsedClip = actualSide === "top"
      ? "inset(100% 0% 0% 0%)"
      : actualSide === "left"
        ? "inset(0% 0% 0% 100%)"
        : actualSide === "right"
          ? "inset(0% 100% 0% 0%)"
          : "inset(0% 0% 100% 0%)";
    const menuMotion =
      animation === "reveal"
        ? undefined
        : floatingMenuMotionStyle(
            state.status,
            state.placement,
            state.motionMode,
          );
    React.useLayoutEffect(() => {
      if (animation !== "reveal" || !mountedNode || !state.isMounted) return;
      if (state.motionMode !== "full") {
        mountedNode.style.clipPath = "none";
      }
      const controls = animate(
        mountedNode,
        {
          opacity: state.open ? 1 : 0,
          clipPath:
            state.motionMode !== "full"
              ? "none"
              : state.open
                ? "inset(0% 0% 0% 0%)"
                : collapsedClip,
        },
        {
          duration:
            state.motionMode === "instant"
              ? 0
              : state.open && state.motionMode === "full"
                ? FLOATING_MENU_OPEN_MS / 1000
                : FLOATING_MENU_CLOSE_MS / 1000,
          ease: state.open ? [0.23, 1, 0.32, 1] : "easeIn",
        },
      );
      return () => controls.stop();
    }, [animate, mountedNode, state.open, state.isMounted, state.motionMode, animation, collapsedClip]);
    const callbacks = React.useRef({ onOpenAutoFocus, onCloseAutoFocus });
    callbacks.current = { onOpenAutoFocus, onCloseAutoFocus };
    state.outside.current = { onInteractOutside, onPointerDownOutside };
    const focus = React.useMemo(
      () => ({
        initial: {
          get current() {
            const event = new Event("openAutoFocus", { cancelable: true });
            callbacks.current.onOpenAutoFocus?.(event);
            return event.defaultPrevented
              ? (document.activeElement as HTMLElement)
              : (state.refs.floating.current?.querySelector<HTMLElement>(
                  'input:not(:disabled),button:not(:disabled),[tabindex="0"]',
                ) ?? state.refs.floating.current);
          },
        },
        restore: {
          get current() {
            const event = new Event("closeAutoFocus", { cancelable: true });
            callbacks.current.onCloseAutoFocus?.(event);
            return event.defaultPrevented
              ? (document.activeElement as HTMLElement)
              : (state.refs.domReference.current as HTMLElement);
          },
        },
      }),
      [state.refs],
    );
    React.useLayoutEffect(() => {
      state.setPlacement(align === "center" ? side : `${side}-${align}`);
      state.setSpacing({
        mainAxis: sideOffset,
        crossAxis: alignOffset,
        padding: collisionPadding,
      });
    }, [
      side,
      align,
      sideOffset,
      alignOffset,
      collisionPadding,
      state.setPlacement,
      state.setSpacing,
    ]);
    if (!state.isMounted && !forceMount) return null;
    return (
      <FloatingPortal root={container}>
        <FloatingFocusManager
          context={state.context}
          disabled={!state.open}
          modal={state.modal}
          initialFocus={focus.initial}
          returnFocus={focus.restore}
        >
          <div
            {...state.getFloatingProps({
              ...props,
              onKeyDownCapture: (event: React.KeyboardEvent<HTMLDivElement>) => {
                state.keyboard.current = true;
                props.onKeyDownCapture?.(event);
              },
              onPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => {
                state.keyboard.current = false;
                props.onPointerDownCapture?.(event);
              },
            })}
            ref={ref}
            tabIndex={-1}
            hidden={!state.isMounted}
            inert={!state.open}
            aria-hidden={!state.open || undefined}
            data-state={state.open ? "open" : "closed"}
            data-side={actualSide}
            data-goose-floating-content=""
            className={cn(
              "z-[20000] outline-none",
              !editorContext &&
                "goose-floating-surface w-64 p-2 text-popover-foreground",
              !editorContext && className,
            )}
            style={{
              ...state.floatingStyles,
              ...style,
              ...menuMotion,
              ...(animation === "reveal"
                ? {
                    opacity: 0,
                    ...(state.motionMode === "full"
                      ? { clipPath: collapsedClip }
                      : { clipPath: "none" }),
                  }
                : {}),
              pointerEvents: state.open ? style?.pointerEvents : "none",
            }}
          >
            {editorContext ? (
              <div
                className={cn(
                  "goose-editor-context-ui goose-floating-surface w-64 p-2 text-popover-foreground",
                  className,
                )}
              >
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    );
  },
);
PopoverTrigger.displayName = "PopoverTrigger";
PopoverAnchor.displayName = "PopoverAnchor";
PopoverContent.displayName = "PopoverContent";
function PopoverAction({
  onSelect,
  onClick,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> & {
  onSelect?: (event: Event) => void;
}) {
  const state = usePopoverContext();
  return (
    <button
      {...props}
      type="button"
      className={cn(
        "goose-interactive relative flex w-full cursor-default select-none items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const select = new Event("select", { cancelable: true });
        onSelect?.(select);
        if (!select.defaultPrevented) state.context.onOpenChange(false);
      }}
    />
  );
}
export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverContent,
  PopoverAction,
};
