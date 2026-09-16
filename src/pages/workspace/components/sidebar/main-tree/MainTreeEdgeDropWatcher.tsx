import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { TreeItem } from "react-complex-tree";
import type { Page } from "@/types";
import {
  resolveMainTreeEdgeZone,
  type MainTreeEdgeZone,
} from "./mainTreeEdgeDrop";

interface EdgeDropIndicator {
  /** 当前拖动轮次；拖动结束后旧指示线不再渲染 */
  dragId: string;
  zone: MainTreeEdgeZone;
  top: number;
  left: number;
  width: number;
}

interface MainTreeEdgeDropWatcherProps {
  /** 可视列表（滚动容器）；上/下缘与最后一行都以它的矩形为准 */
  containerRef: RefObject<HTMLElement | null>;
  /** 树内拖动中的条目 id；null 表示当前没有内部拖动 */
  draggingItemId: string | null;
  draggedItem: TreeItem<Page> | undefined;
  onEdgeDrop: (zone: MainTreeEdgeZone, item: TreeItem<Page>) => void;
}

/**
 * rct 用 isOutsideOfContainer 判定落点：指针贴到树容器边线或越出时落点无效
 * （松手什么都不发生），行内又只有文件夹顶部 20% 才算“插到最前”。
 * 这里在应用层接管树内拖动：指针到可视列表上/下缘（含垂直越界、底部空白）时，
 * 明确按根级首/末位置落点，并把可视边缘线画出来；中部仍交给 rct 处理。
 */
export function MainTreeEdgeDropWatcher({
  containerRef,
  draggingItemId,
  draggedItem,
  onEdgeDrop,
}: MainTreeEdgeDropWatcherProps) {
  const [indicator, setIndicator] = useState<EdgeDropIndicator | null>(null);
  const indicatorRef = useRef<EdgeDropIndicator | null>(null);
  // window 监听在整段拖动里只注册一次，回调与条目用 ref 取最新值
  const latestRef = useRef({ onEdgeDrop, draggedItem });

  useEffect(() => {
    latestRef.current = { onEdgeDrop, draggedItem };
  }, [onEdgeDrop, draggedItem]);

  const visible =
    indicator && indicator.dragId === draggingItemId ? indicator : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (visible) {
      container.setAttribute("data-main-tree-edge-drop", visible.zone);
    } else {
      container.removeAttribute("data-main-tree-edge-drop");
    }
    return () => container.removeAttribute("data-main-tree-edge-drop");
  }, [containerRef, visible]);

  useEffect(() => {
    if (!draggingItemId) return;
    const container = containerRef.current;
    if (!container) return;
    indicatorRef.current = null;

    const readEdge = (event: DragEvent) => {
      const viewportRect = container.getBoundingClientRect();
      const rows = container.querySelectorAll(
        "[data-rct-item-container='true']",
      );
      const lastRow = rows[rows.length - 1];
      const lastRowBottom = lastRow
        ? lastRow.getBoundingClientRect().bottom
        : Number.POSITIVE_INFINITY;
      return {
        viewportRect,
        zone: resolveMainTreeEdgeZone({
          pointerX: event.clientX,
          pointerY: event.clientY,
          viewportRect,
          lastRowBottom,
        }),
      };
    };

    const updateIndicator = (
      zone: MainTreeEdgeZone | null,
      viewportRect: { top: number; bottom: number; left: number; width: number },
    ) => {
      const current = indicatorRef.current;
      if (!zone) {
        if (!current) return;
        indicatorRef.current = null;
        setIndicator(null);
        return;
      }
      const next: EdgeDropIndicator = {
        dragId: draggingItemId,
        zone,
        top: zone === "top" ? viewportRect.top : viewportRect.bottom - 2,
        left: viewportRect.left + 6,
        width: Math.max(viewportRect.width - 14, 0),
      };
      if (
        current?.zone === next.zone &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width
      ) {
        return;
      }
      indicatorRef.current = next;
      setIndicator(next);
    };

    const handleWindowDragOver = (event: DragEvent) => {
      const { zone, viewportRect } = readEdge(event);
      if (zone) {
        // 越界时 rct 与树容器都不会 preventDefault，浏览器就不会派发 drop
        event.preventDefault();
        event.stopPropagation();
      }
      updateIndicator(zone, viewportRect);
    };

    const handleWindowDrop = (event: DragEvent) => {
      const { zone } = readEdge(event);
      const item = latestRef.current.draggedItem;
      indicatorRef.current = null;
      setIndicator(null);
      if (!zone || !item) return;
      // 接管这一次落点：阻止 rct 的 window drop 监听重复处理同一个 drop
      event.preventDefault();
      event.stopPropagation();
      latestRef.current.onEdgeDrop(zone, item);
    };

    window.addEventListener("dragover", handleWindowDragOver, true);
    window.addEventListener("drop", handleWindowDrop, true);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver, true);
      window.removeEventListener("drop", handleWindowDrop, true);
    };
  }, [containerRef, draggingItemId]);

  if (!visible) return null;

  // 侧栏祖先带 transform（成为 fixed 的包含块），所以挂到 body 才是真正的视口坐标
  return createPortal(
    <div
      aria-hidden
      className="main-tree-drop-between-line main-tree-edge-drop-line"
      style={{
        position: "fixed",
        top: visible.top,
        left: visible.left,
        width: visible.width,
        height: 2,
        marginLeft: 0,
        marginRight: 0,
      }}
    />,
    document.body,
  );
}
