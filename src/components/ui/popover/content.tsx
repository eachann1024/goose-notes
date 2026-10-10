import * as React from "react";
import { FloatingFocusManager, FloatingPortal, useMergeRefs } from "@floating-ui/react";
import { useAnimate } from "motion/react";
import { cn } from "@/lib/utils";
import { FLOATING_MENU_CLOSE_MS, FLOATING_MENU_OPEN_MS, floatingMenuMotionStyle } from "../floating-menu-motion";

import { usePopoverContext } from "./state";

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
export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
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
            { notebook: state.variant === "notebook" },
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
    const notebookMenu = state.variant === "notebook";
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
                  notebookMenu
                    ? '[aria-current="true"]'
                    : 'input:not(:disabled),button:not(:disabled),[tabindex="0"]',
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
      [state.refs, notebookMenu],
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
          initialFocus={notebookMenu && !state.keyboard.current ? -1 : focus.initial}
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
            data-motion={state.motionMode}
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

PopoverContent.displayName = "PopoverContent";
