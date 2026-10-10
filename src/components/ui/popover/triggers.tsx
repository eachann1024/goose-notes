import * as React from "react";
import { useMergeRefs } from "@floating-ui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "../trigger-child";

import { usePopoverContext } from "./state";

export const PopoverTrigger = React.forwardRef<
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
export const PopoverAnchor = React.forwardRef<
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
export function PopoverAction({
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
        "goose-interactive relative flex w-full cursor-default select-none items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-[13px] outline-none transition-colors disabled:pointer-events-none disabled:text-disabled",
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

PopoverTrigger.displayName = "PopoverTrigger";
PopoverAnchor.displayName = "PopoverAnchor";
