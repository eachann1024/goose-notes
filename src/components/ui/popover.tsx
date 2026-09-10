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
  type Placement,
} from "@floating-ui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";

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
  const outside = React.useRef<{
    onInteractOutside?: (event: Event) => void;
    onPointerDownOutside?: (event: Event) => void;
  }>({});
  const floating = useFloating({
    open,
    onOpenChange: (next) => {
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
    ...state.getReferenceProps(props),
    ref,
    "data-state": state.open ? "open" : "closed",
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
    const ref = useMergeRefs([forwardedRef, state.refs.setFloating]);
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
    if (!state.open && !forceMount) return null;
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
            {...state.getFloatingProps(props)}
            ref={ref}
            tabIndex={-1}
            hidden={!state.open}
            data-state={state.open ? "open" : "closed"}
            data-side={state.placement.split("-")[0]}
            data-goose-floating-content=""
            className={cn(
              "z-[20000] outline-none",
              !editorContext &&
                "w-64 rounded-[10px] border border-border/80 bg-[hsl(var(--popover))] p-2 text-popover-foreground",
              !editorContext && className,
            )}
            style={{
              ...state.floatingStyles,
              boxShadow: editorContext
                ? undefined
                : "0 8px 22px rgba(15,23,42,0.1), 0 1px 3px rgba(15,23,42,0.06)",
              ...style,
            }}
          >
            {editorContext ? (
              <div
                className={cn(
                  "goose-editor-context-ui w-64 rounded-[10px] border border-border/80 bg-[hsl(var(--popover))] p-2 text-popover-foreground",
                  className,
                )}
                style={{
                  boxShadow:
                    "0 8px 22px rgba(15,23,42,0.1), 0 1px 3px rgba(15,23,42,0.06)",
                }}
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
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] disabled:pointer-events-none disabled:opacity-50",
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
