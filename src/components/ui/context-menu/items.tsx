import * as GooseIcons from "@/components/ui/icons";
import * as React from "react";
import { useListItem, useMergeRefs } from "@floating-ui/react";
import { cn } from "@/lib/utils";

import { ParentMenuContext, useMenu } from "./state";

type MenuItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onSelect"
> & { inset?: boolean; onSelect?: (event: Event) => void };
const itemClass =
  "goose-interactive goose-menu-item relative flex w-full cursor-default select-none items-center gap-2 px-2 py-0 text-left text-sm leading-5 outline-none transition-colors disabled:pointer-events-none disabled:text-disabled";
export const ContextMenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  (
    { className, inset, disabled, onSelect, onClick, children, ...props },
    forwardedRef,
  ) => {
    const state = useMenu();
    const item = useListItem({ label: disabled ? null : undefined });
    const ref = useMergeRefs([forwardedRef, item.ref]);
    return (
      <button
        {...state.getItemProps({
          ...props,
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            const select = new Event("select", { cancelable: true });
            onSelect?.(select);
            if (!select.defaultPrevented)
              state.tree?.events.emit("context-menu-select");
          },
          onFocus: () => state.setActiveIndex(item.index),
        })}
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        tabIndex={state.activeIndex === item.index ? 0 : -1}
        data-highlighted={state.activeIndex === item.index ? "" : undefined}
        className={cn(itemClass, inset && "pl-8", className)}
      >
        {children}
      </button>
    );
  },
);
export const ContextMenuSubTrigger = React.forwardRef<
  HTMLButtonElement,
  MenuItemProps
>(
  (
    { children, className, inset, disabled, onSelect, ...props },
    forwardedRef,
  ) => {
    const state = useMenu();
    const parent = React.useContext(ParentMenuContext)!;
    const item = useListItem({ label: disabled ? null : undefined });
    const ref = useMergeRefs([forwardedRef, item.ref, state.refs.setReference]);
    return (
      <button
        {...parent.getItemProps(
          state.getReferenceProps({
            ...props,
            onFocus: () => parent.setActiveIndex(item.index),
            onClick: () => {
              if (!disabled) state.context.onOpenChange(!state.open);
            },
          }),
        )}
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        tabIndex={parent.activeIndex === item.index ? 0 : -1}
        data-state={state.open ? "open" : "closed"}
        className={cn(itemClass, inset && "pl-8", className)}
      >
        {children}
        <GooseIcons.ChevronRight className="ml-auto h-4 w-4" />
      </button>
    );
  },
);
export function ContextMenuGroup(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" {...props} />;
}
export function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground",
        inset && "pl-8",
        className,
      )}
    />
  );
}
export function ContextMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      role="separator"
      className={cn("goose-menu-separator h-px", className)}
    />
  );
}
export function ContextMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        "ml-auto text-xs tracking-wide text-muted-foreground",
        className,
      )}
    />
  );
}

ContextMenuItem.displayName = "ContextMenuItem";
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";
