import * as React from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingList,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  useHover,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from "@floating-ui/react";
import { useContextMenu } from "@/components/editor/state/contextMenu";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";

function isDescendantNode(
  tree: ReturnType<typeof useFloatingTree>,
  nodeId: string | undefined,
  ancestorId: string | undefined,
) {
  if (!nodeId || !ancestorId) return false;
  let parentId = tree?.nodesRef.current.find((node) => node.id === nodeId)
    ?.parentId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = tree?.nodesRef.current.find((node) => node.id === parentId)
      ?.parentId;
  }
  return false;
}

function isInsideMenuFloating(
  target: Node,
  floating: HTMLElement | null,
  tree: ReturnType<typeof useFloatingTree>,
  nodeId: string | undefined,
) {
  if (floating?.contains(target)) return true;
  return (
    tree?.nodesRef.current.some((node) => {
      if (node.id !== nodeId && !isDescendantNode(tree, node.id, nodeId)) {
        return false;
      }
      return Boolean(node.context?.elements.floating?.contains(target));
    }) ?? false
  );
}

function useMenuState(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  nested: boolean,
) {
  const nodeId = useFloatingNodeId();
  const tree = useFloatingTree();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const elements = React.useRef<Array<HTMLElement | null>>([]);
  const labels = React.useRef<Array<string | null>>([]);
  const floating = useFloating({
    nodeId,
    open,
    onOpenChange,
    placement: nested ? "right-start" : "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(nested ? 2 : 0),
      flip({ padding: 8 }),
      shift({ padding: 8, crossAxis: !nested }),
    ],
  });
  const hover = useHover(floating.context, {
    enabled: nested,
    delay: { open: 100 },
    handleClose: safePolygon({ blockPointerEvents: true }),
  });
  const dismiss = useDismiss(floating.context, {
    bubbles: { escapeKey: false, outsidePress: true },
    outsidePress: false,
  });
  const role = useRole(floating.context, { role: "menu" });
  const navigation = useListNavigation(floating.context, {
    listRef: elements,
    activeIndex,
    onNavigate: setActiveIndex,
    nested,
    openOnArrowKeyDown: nested,
    loop: true,
    focusItemOnOpen: true,
  });
  const typeahead = useTypeahead(floating.context, {
    listRef: labels,
    activeIndex,
    onMatch: setActiveIndex,
    enabled: open,
  });
  React.useEffect(() => {
    // 关闭后清空高亮，再次打开时由 floating-ui 重新聚焦第一可用项，
    // 不会残留上次打开时的高亮项。
    if (!open) setActiveIndex(null);
  }, [open]);
  React.useEffect(() => {
    const close = () => onOpenChange(false);
    tree?.events.on("context-menu-select", close);
    return () => tree?.events.off("context-menu-select", close);
  }, [tree, onOpenChange]);
  React.useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        onOpenChange(false);
        return;
      }
      if (
        isInsideMenuFloating(
          target,
          floating.refs.floating.current,
          tree,
          nodeId,
        )
      ) {
        return;
      }
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutside, true);
  }, [open, onOpenChange, tree, nodeId, floating.refs]);
  return {
    ...floating,
    ...useInteractions([hover, dismiss, role, navigation, typeahead]),
    open,
    nested,
    nodeId,
    tree,
    activeIndex,
    setActiveIndex,
    elements,
    labels,
  };
}
const MenuContext = React.createContext<ReturnType<typeof useMenuState> | null>(
  null,
);
const ParentMenuContext = React.createContext<ReturnType<
  typeof useMenuState
> | null>(null);
function useMenu() {
  const value = React.useContext(MenuContext);
  if (!value) throw new Error("ContextMenu components require ContextMenu");
  return value;
}
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
function ContextMenu(props: ContextMenuProps) {
  const parentId = useFloatingParentNodeId();
  return parentId === null ? (
    <FloatingTree>
      <ContextMenuRoot {...props} />
    </FloatingTree>
  ) : (
    <ContextMenuRoot {...props} />
  );
}
const ContextMenuTrigger = React.forwardRef<
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
            longPress.current = setTimeout(
              () => openAt(clientX, clientY, currentTarget),
              700,
            );
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
function ContextMenuSub({ children }: React.PropsWithChildren) {
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
type MenuItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onSelect"
> & { inset?: boolean; onSelect?: (event: Event) => void };
const itemClass =
  "goose-menu-item relative flex w-full cursor-default select-none items-center gap-2 px-2 py-0 text-left text-sm leading-5 outline-none transition-colors data-[highlighted]:text-[var(--goose-interactive-selected-fg)] disabled:pointer-events-none disabled:opacity-50";
const ContextMenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
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
const ContextMenuSubTrigger = React.forwardRef<
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
        <LucideIcons.ChevronRight className="ml-auto h-4 w-4" />
      </button>
    );
  },
);
type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  editorContext?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
};
const ContextMenuContent = React.forwardRef<HTMLDivElement, ContentProps>(
  (
    {
      className,
      children,
      editorContext,
      onCloseAutoFocus,
      sideOffset,
      alignOffset,
      collisionPadding,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const state = useMenu();
    const ref = useMergeRefs([forwardedRef, state.refs.setFloating]);
    const callback = React.useRef(onCloseAutoFocus);
    callback.current = onCloseAutoFocus;
    const restore = React.useMemo(
      () => ({
        get current() {
          const event = new Event("closeAutoFocus", { cancelable: true });
          callback.current?.(event);
          return event.defaultPrevented
            ? (document.activeElement as HTMLElement)
            : (state.refs.domReference.current as HTMLElement);
        },
      }),
      [state.refs],
    );
    if (!state.open) return null;
    const surface =
      "goose-menu-surface min-w-[9.5rem] max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain p-1 text-popover-foreground";
    return (
      <FloatingPortal>
        <FloatingFocusManager
          context={state.context}
          modal={false}
          initialFocus={state.nested ? -1 : 0}
          returnFocus={restore}
        >
          <div
            {...state.getFloatingProps(props)}
            aria-labelledby={
              props["aria-label"]
                ? undefined
                : state.refs.domReference.current?.id
            }
            ref={ref}
            tabIndex={-1}
            data-state="open"
            data-side={state.placement.split("-")[0]}
            data-goose-floating-content=""
            className={cn(
              "z-[20000] outline-none",
              !editorContext && surface,
              !editorContext && className,
            )}
            style={{
              ...state.floatingStyles,
              ...style,
            }}
          >
            <FloatingList elementsRef={state.elements} labelsRef={state.labels}>
              {editorContext ? (
                <div
                  className={cn("goose-editor-context-ui", surface, className)}
                >
                  {children}
                </div>
              ) : (
                children
              )}
            </FloatingList>
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    );
  },
);
const ContextMenuSubContent = ContextMenuContent;
function ContextMenuPortal({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
function ContextMenuGroup(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" {...props} />;
}
function ContextMenuLabel({
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
function ContextMenuSeparator({
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
function ContextMenuShortcut({
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
ContextMenuTrigger.displayName = "ContextMenuTrigger";
ContextMenuItem.displayName = "ContextMenuItem";
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";
ContextMenuContent.displayName = "ContextMenuContent";
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
};
