import { DRAG_HANDLE_CONSTANTS } from "./constants";

/**
 * 获取调整后的坐标，用于查找节点
 * 消除 5 处重复的坐标计算逻辑
 */
export function getAdjustedCoords(
  event: { clientX: number; clientY: number },
  dragHandleWidth: number,
): { x: number; y: number } {
  return {
    x: event.clientX + DRAG_HANDLE_CONSTANTS.coordsOffset + dragHandleWidth,
    y: event.clientY,
  };
}

/**
 * 检查元素是否是编辑器的第一个子元素
 * 消除 4 处重复的检查逻辑
 */
export function isFirstChildOfEditor(node: Element): boolean {
  const parent = node.parentElement;
  return (
    !!parent?.matches?.(".ProseMirror") && parent?.firstElementChild === node
  );
}

/**
 * 获取绝对坐标（相对于视口或最近的 transform 容器）
 */
export function absoluteRect(
  node: Element,
): { top: number; left: number; width: number } {
  const data = node.getBoundingClientRect();
  const modal = node.closest('[role="dialog"]');

  if (modal && window.getComputedStyle(modal).transform !== "none") {
    const modalRect = modal.getBoundingClientRect();
    return {
      top: data.top - modalRect.top,
      left: data.left - modalRect.left,
      width: data.width,
    };
  }

  return {
    top: data.top,
    left: data.left,
    width: data.width,
  };
}

/**
 * 计算块节点在文档中的位置
 * 消除 4 处类似的遍历逻辑
 */
export function findBlockNodePos($pos: any): number {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.isBlock && node.type.name !== "doc") {
      return $pos.before(d);
    }
  }
  return $pos.pos;
}

/**
 * 获取节点在 DOM 中的位置（ProseMirror 坐标）
 */
export function nodePosAtDOM(
  node: Element,
  view: any,
  dragHandleWidth: number,
): number | null {
  const boundingRect = node.getBoundingClientRect();
  const coords = view.posAtCoords({
    left: boundingRect.left + DRAG_HANDLE_CONSTANTS.coordsOffset + dragHandleWidth,
    top: boundingRect.top + 1,
  });
  return coords?.inside ?? null;
}

/**
 * 计算最终的节点位置（处理表格特殊情况）
 */
export function calcNodePos(pos: number, view: any): number {
  const $pos = view.state.doc.resolve(pos);

  // 如果在表格内，返回表格开始位置
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "table") {
      return $pos.before(d);
    }
  }

  // 否则返回最近的块节点开始位置
  if ($pos.depth > 1) return $pos.before($pos.depth);
  return pos;
}
