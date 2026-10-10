import * as React from "react";
import { autoUpdate, flip, offset, safePolygon, shift, useDismiss, useFloating, useFloatingNodeId, useFloatingTree, useHover, useInteractions, useListNavigation, useRole, useTransitionStatus, useTypeahead } from "@floating-ui/react";
import { useReducedMotion } from "motion/react";
import { FLOATING_MENU_CLOSE_MS, FLOATING_MENU_OPEN_MS, type FloatingMotionMode } from "../floating-menu-motion";

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

export function useMenuState(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  nested: boolean,
) {
  const nodeId = useFloatingNodeId();
  const tree = useFloatingTree();
  const keyboard = React.useRef(true);
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const elements = React.useRef<Array<HTMLElement | null>>([]);
  const labels = React.useRef<Array<string | null>>([]);
  const floating = useFloating({
    nodeId,
    open,
    transform: false,
    onOpenChange: (next, event) => {
      if (event) {
        keyboard.current =
          event.type === "keydown" ||
          (event.type === "click" && (event as MouseEvent).detail === 0);
      }
      onOpenChange(next);
    },
    placement: nested ? "right-start" : "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(nested ? 2 : 0),
      flip({ padding: 8 }),
      shift({ padding: 8, crossAxis: !nested }),
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
    ...presence,
    ...useInteractions([hover, dismiss, role, navigation, typeahead]),
    open,
    nested,
    nodeId,
    tree,
    keyboard,
    motionMode: (keyboard.current
      ? "instant"
      : reducedMotion
        ? "reduced"
        : "full") as FloatingMotionMode,
    activeIndex,
    setActiveIndex,
    elements,
    labels,
  };
}
export const MenuContext = React.createContext<ReturnType<typeof useMenuState> | null>(
  null,
);
export const ParentMenuContext = React.createContext<ReturnType<
  typeof useMenuState
> | null>(null);
export function useMenu() {
  const value = React.useContext(MenuContext);
  if (!value) throw new Error("ContextMenu components require ContextMenu");
  return value;
}
