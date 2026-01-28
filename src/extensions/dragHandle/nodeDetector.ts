import { HANDLE_OFFSETS } from "./constants";

/**
 * 节点类型定义
 */
export type NodeOffsetType = keyof typeof HANDLE_OFFSETS;

/**
 * 获取节点对应的偏移类型
 * 消除了 updateHandlePosition 中硬编码的位置偏移逻辑
 */
export function getNodeOffsetType(node: Element): NodeOffsetType {
  // 标题有折叠按钮，需要偏移
  if (node.closest(".heading-collapse-anchor")) {
    return "headingWithCollapse";
  }

  // 表格左移 10px
  if (node.matches(".tableWrapper, table") || node.closest(".tableWrapper")) {
    return "table";
  }

  // 待办列表项需要更大偏移（checkbox 在左侧 -24px）
  if (node.matches('ul[data-type="taskList"] > li') ||
      node.closest('ul[data-type="taskList"] > li')) {
    return "taskListItem";
  }

  // 普通列表项需要偏移（包括 li 内部的元素）
  if (node.matches("ul:not([data-type=taskList]) li, ol li") ||
      node.closest("ul:not([data-type=taskList]) > li, ol > li")) {
    return "listItem";
  }

  return "default";
}

/**
 * 获取节点的完整信息（类型 + 偏移）
 */
export function getNodeOffsetInfo(node: Element) {
  const type = getNodeOffsetType(node);
  const offset = HANDLE_OFFSETS[type] ?? 0;
  return { type, offset };
}

/**
 * 检测节点是否是特殊块类型（需要特殊处理坐标）
 */
export function isSpecialBlockType(node: Element): {
  isTableWrapper: boolean;
  isTable: boolean;
  isCodeBlock: boolean;
  targetNode: Element;
} {
  const isTableWrapper = node.matches(".tableWrapper");
  const isTable = node.matches("table");
  const isCodeBlock = node.matches("pre");

  let targetNode = node;
  if (isTableWrapper) {
    const table = node.querySelector("table");
    if (table) targetNode = table;
  }

  return {
    isTableWrapper,
    isTable,
    isCodeBlock,
    targetNode,
  };
}
