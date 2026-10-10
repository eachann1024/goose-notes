import * as React from "react";
import { FloatingNode, FloatingTree, useFloatingParentNodeId, useMergeRefs } from "@floating-ui/react";
import { useContextMenu } from "@/components/editor/state/contextMenu";
import { TriggerChild } from "../trigger-child";

import { useMenuState, MenuContext, ParentMenuContext, useMenu } from "./state";

type ContextMenuProps = React.PropsWithChildren<{
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}>;
function ContextMenuRoot({ children, onOpenChange }: ContextMenuProps) {
  const [id] = React.useState(() => useContextMenu.getState().generateId());
  const open = useContextMenu((store) => store.openMenuId === id);
  const callback = React.useRef(onOpenChange);
  callback.current = onOpenChange;
  const previous = React.useRef(false);
  const change = React.useCallback(
    (next: boolean) => {
      if (previous.current !== next) {
        previous.current = next;
        callback.current?.(next);
      }
      const store = useContextMenu.getState();
      if (next) store.open(id);
      else if (store.openMenuId === id) store.close();
    },
    [id],
  );
  React.useEffect(() => {
    if (previous.current !== open) {
      previous.current = open;
      callback.current?.(open);
    }
  }, [open]);
  React.useEffect(
    () => () => {
      if (useContextMenu.getState().openMenuId === id)
        useContextMenu.getState().close();
    },
    [id],
  );
  const state = useMenuState(open, change, false);
  return (
    <FloatingNode id={state.nodeId}>
      <MenuContext.Provider value={state}>{children}</MenuContext.Provider>
    </FloatingNode>
  );
}
export function ContextMenu(props: ContextMenuProps) {
  const parentId = useFloatingParentNodeId();
  return parentId === null ? (
    <FloatingTree>
      <ContextMenuRoot {...props} />
    </FloatingTree>
  ) : (
    <ContextMenuRoot {...props} />
  );
}
export const ContextMenuTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean; disabled?: boolean }
>(
  (
    {
      asChild,
      disabled,
      children,
      onContextMenu,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    forwardedRef,
  ) => {
    const state = useMenu();
    const longPress = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelLongPress = () => {
      if (longPress.current !== null) clearTimeout(longPress.current);
      longPress.current = null;
    };
    React.useEffect(() => cancelLongPress, []);
    const ref = useMergeRefs([forwardedRef, state.refs.setReference]);
    const openAt = (x: number, y: number, target: HTMLElement) => {
      state.refs.setPositionReference({
        contextElement: target,
        getBoundingClientRect: () => ({
          x,
          y,
          top: y,
          left: x,
          right: x,
          bottom: y,
          width: 0,
          height: 0,
        }),
      });
      state.context.onOpenChange(true);
    };
    const injected = {
      ...props,
      ...state.getReferenceProps({
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          onPointerDown?.(event);
          cancelLongPress();
          if (
            !disabled &&
            !event.defaultPrevented &&
            event.pointerType !== "mouse"
          ) {
            const { clientX, clientY, currentTarget } = event;
            longPress.current = setTimeout(() => {
              state.keyboard.current = false;
              openAt(clientX, clientY, currentTarget);
            }, 700);
          }
        },
        onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
          onPointerMove?.(event);
          cancelLongPress();
        },
        onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
          onPointerUp?.(event);
          cancelLongPress();
        },
        onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
          onPointerCancel?.(event);
          cancelLongPress();
        },
        onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
          onContextMenu?.(event);
          cancelLongPress();
          if (disabled || event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          state.keyboard.current = false;
          openAt(event.clientX, event.clientY, event.currentTarget);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          onKeyDown?.(event);
          if (disabled || event.defaultPrevented) return;
          if (
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
            event.stopPropagation();
            state.keyboard.current = true;
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            openAt(rect.left, rect.bottom, event.currentTarget);
          }
        },
      }),
      role: props.role,
      ref,
      "data-state": state.open ? "open" : "closed",
    };
    return asChild && React.isValidElement(children) ? (
      <TriggerChild
        child={
          children as React.ReactElement<React.HTMLAttributes<HTMLElement>>
        }
        injected={injected}
      />
    ) : (
      <span {...injected}>{children}</span>
    );
  },
);
export function ContextMenuSub({ children }: React.PropsWithChildren) {
  const parent = useMenu();
  const [open, setOpen] = React.useState(false);
  const state = useMenuState(open && parent.open, setOpen, true);
  React.useEffect(() => {
    if (!parent.open) setOpen(false);
  }, [parent.open]);
  return (
    <FloatingNode id={state.nodeId}>
      <ParentMenuContext.Provider value={parent}>
        <MenuContext.Provider value={state}>{children}</MenuContext.Provider>
      </ParentMenuContext.Provider>
    </FloatingNode>
  );
}

ContextMenuTrigger.displayName = "ContextMenuTrigger";
