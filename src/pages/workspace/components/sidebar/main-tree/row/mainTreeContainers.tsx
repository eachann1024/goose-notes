import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { normalizeMainTreeDragOver } from "../mainTreeDragGeometry";
import { snapDragBetweenLine } from "../mainTreeLocalDrop";
import {
  INDENT,
  ROW_PADDING_LEFT,
  type RenderItemsContainerArgs,
  type RenderTreeContainerArgs,
  type RenderDragBetweenLineArgs,
} from "./mainTreeRowConfig";

export function renderItemArrow() {
  return null;
}

export function renderItemsContainer({
  children,
  containerProps,
}: RenderItemsContainerArgs) {
  return (
    <ul {...containerProps} className="list-none p-0 m-0">
      {children}
    </ul>
  );
}

export function renderTreeContainer({
  children,
  containerProps,
}: RenderTreeContainerArgs) {
  const { onDragOver, ...rest } = containerProps;
  return (
    <div
      {...rest}
      className="rct-main-tree outline-none min-h-full"
      onDragOver={(event) => {
        onDragOver?.(normalizeMainTreeDragOver(event, event.currentTarget));
      }}
    >
      {children}
    </div>
  );
}

export function MainTreeDragBetweenLine({
  draggingPosition,
  lineProps,
}: RenderDragBetweenLineArgs) {
  const lineRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const lineEl = lineRef.current;
    if (!lineEl) return;
    snapDragBetweenLine(lineEl, draggingPosition.linearIndex ?? 0);
  }, [draggingPosition]);

  const depth = draggingPosition.depth ?? 0;
  const style = (lineProps.style ?? {}) as CSSProperties;
  // 紧凑布局：文件夹本体承载展开控件，不额外保留箭头列。
  const lineStart = depth * INDENT + ROW_PADDING_LEFT;
  return (
    <div
      ref={lineRef}
      {...lineProps}
      style={{
        ...style,
        marginLeft: lineStart,
        marginRight: 8,
      }}
      className="main-tree-drop-between-line h-[2px] rounded-marker"
    />
  );
}

export function renderDragBetweenLine(args: RenderDragBetweenLineArgs) {
  return <MainTreeDragBetweenLine {...args} />;
}
