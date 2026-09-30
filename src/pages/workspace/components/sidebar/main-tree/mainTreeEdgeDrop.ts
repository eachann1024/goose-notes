import type { DraggingPosition } from "react-complex-tree";

/**
 * 主树可视列表上/下缘吸附带高度（约 1/3 行高）：指针进入该带、或垂直越出
 * 可视列表时，落点固定解析为根级首/末位置，而不是靠 rct 的行中线与
 * 文件夹顶部窄带命中（越出树容器时 rct 判定落点无效，根本不落）。
 */
export const MAIN_TREE_EDGE_BAND = 12;

export type MainTreeEdgeZone = "top" | "bottom";

export interface MainTreeEdgeZoneParams {
  pointerX: number;
  pointerY: number;
  /** 可视列表（滚动容器）矩形 */
  viewportRect: { top: number; bottom: number; left: number; right: number };
  /** 可视列表最后一行底边；内容比视口短时，其下方空白同样按“下缘”处理 */
  lastRowBottom: number;
}

/**
 * 指针位于可视列表上/下缘或垂直越界时返回边缘落点；中部行内返回 null，
 * 保留行内排序与拖入文件夹语义。横向移出列表（例如拖到编辑区）不触发。
 */
export function resolveMainTreeEdgeZone({
  pointerX,
  pointerY,
  viewportRect,
  lastRowBottom,
}: MainTreeEdgeZoneParams): MainTreeEdgeZone | null {
  if (pointerX < viewportRect.left || pointerX > viewportRect.right) {
    return null;
  }
  if (pointerY <= viewportRect.top + MAIN_TREE_EDGE_BAND) {
    return "top";
  }
  if (
    pointerY >= viewportRect.bottom - MAIN_TREE_EDGE_BAND ||
    pointerY >= lastRowBottom
  ) {
    return "bottom";
  }
  return null;
}

/**
 * 边缘落点 → 根级首/末插入位置。
 * parentItem 固定为 root，childIndex 基于根级子项计数：置底是「根级最后一项
 * 之后」，不会落到展开文件夹的最后一个子项后面。
 */
export function mainTreeEdgeDropTarget(
  zone: MainTreeEdgeZone,
  rootChildCount: number,
): DraggingPosition {
  return {
    // rct 要求带 treeId；应用层落点处理不使用它
    treeId: "main",
    targetType: "between-items",
    parentItem: "root",
    childIndex: zone === "top" ? 0 : rootChildCount,
    linearIndex: zone === "top" ? 0 : Math.max(rootChildCount - 1, 0),
    depth: 0,
    linePosition: zone === "top" ? "top" : "bottom",
  };
}
