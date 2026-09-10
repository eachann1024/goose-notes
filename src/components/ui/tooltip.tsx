import * as React from "react";
import {
  autoUpdate,
  flip,
  FloatingDelayGroup,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDelayGroup,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  type Placement,
} from "@floating-ui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";
import { TOOLTIP_DELAY_MS, resolveTooltipDelayDuration } from "./tooltip-delay";

const TooltipOptions = React.createContext({
  delay: TOOLTIP_DELAY_MS,
  disableHoverableContent: false,
});
function TooltipProvider({
  delayDuration = TOOLTIP_DELAY_MS,
  skipDelayDuration = 300,
  disableHoverableContent = false,
  children,
}: React.PropsWithChildren<{
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}>) {
  const delay = resolveTooltipDelayDuration(delayDuration);
  return (
    <TooltipOptions.Provider value={{ delay, disableHoverableContent }}>
      <FloatingDelayGroup delay={delay} timeoutMs={skipDelayDuration}>
        {children}
      </FloatingDelayGroup>
    </TooltipOptions.Provider>
  );
}
function useTooltipState({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  delayDuration,
  disableHoverableContent,
}: TooltipProps) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const open = controlled ?? localOpen;
  const options = React.useContext(TooltipOptions);
  const [placement, setPlacement] = React.useState<Placement>("top");
  const [gap, setGap] = React.useState(4);
  const floating = useFloating({
    open,
    onOpenChange: (next) => {
      if (controlled === undefined) setLocalOpen(next);
      onOpenChange?.(next);
    },
    placement,
    middleware: [offset(gap), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const group = useDelayGroup(floating.context);
  const delay = group.currentId
    ? 1
    : delayDuration === undefined
      ? options.delay
      : resolveTooltipDelayDuration(delayDuration);
  const hover = useHover(floating.context, {
    move: false,
    delay: { open: delay, close: 0 },
    handleClose:
      (disableHoverableContent ?? options.disableHoverableContent)
        ? undefined
        : safePolygon({ blockPointerEvents: false }),
  });
  const focus = useFocus(floating.context);
  const dismiss = useDismiss(floating.context, { referencePress: true });
  const role = useRole(floating.context, { role: "tooltip" });
  return {
    ...floating,
    ...useInteractions([hover, focus, dismiss, role]),
    open,
    setPlacement,
    setGap,
  };
}
type TooltipProps = React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
  disableHoverableContent?: boolean;
}>;
const TooltipContext = React.createContext<ReturnType<
  typeof useTooltipState
> | null>(null);
function useTooltipContext() {
  const value = React.useContext(TooltipContext);
  if (!value) throw new Error("Tooltip components require Tooltip");
  return value;
}
function Tooltip({ children, ...props }: TooltipProps) {
  const state = useTooltipState(props);
  return (
    <TooltipContext.Provider value={state}>{children}</TooltipContext.Provider>
  );
}
const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, forwardedRef) => {
  const state = useTooltipContext();
  const ref = useMergeRefs([forwardedRef, state.refs.setReference]);
  const injected = { ...state.getReferenceProps(props), ref };
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
type TooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  editorContext?: boolean;
};
const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    {
      className,
      side = "top",
      align = "center",
      sideOffset = 4,
      editorContext,
      children,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const state = useTooltipContext();
    const ref = useMergeRefs([forwardedRef, state.refs.setFloating]);
    React.useLayoutEffect(() => {
      state.setPlacement(align === "center" ? side : `${side}-${align}`);
      state.setGap(sideOffset);
    }, [side, align, sideOffset, state.setPlacement, state.setGap]);
    if (!state.open) return null;
    return (
      <FloatingPortal>
        <div
          {...state.getFloatingProps(props)}
          ref={ref}
          data-state="open"
          data-side={state.placement.split("-")[0]}
          style={{ ...state.floatingStyles, ...style }}
          className={cn(
            "z-[21000]",
            !editorContext &&
              "select-none overflow-hidden whitespace-nowrap rounded-[14px] border border-border/80 bg-popover px-2.5 py-1.5 text-[12px] font-medium leading-none text-popover-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-[1px] dark:border-white/20",
            !editorContext && className,
          )}
        >
          {editorContext ? (
            <div
              className={cn(
                "goose-editor-tooltip-surface select-none overflow-hidden whitespace-nowrap border border-border/80 bg-popover font-medium leading-none text-popover-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-[1px] dark:border-white/20",
                className,
              )}
            >
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </FloatingPortal>
    );
  },
);
TooltipTrigger.displayName = "TooltipTrigger";
TooltipContent.displayName = "TooltipContent";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
