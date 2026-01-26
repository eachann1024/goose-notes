// 节点类型对应的位置偏移（单位：像素）
export const HANDLE_OFFSETS: Record<string, number> = {
  default: 0,
  headingWithCollapse: -15,  // 折叠箭头左边
  listItem: -10,              // 列表项微调
};

// 通用常量
export const DRAG_HANDLE_CONSTANTS = {
  coordsOffset: 50,           // 查找节点时的 X 偏移
  editorMarginRight: 10,      // 手柄离编辑器边界距离
  safeMargin: 30,             // 鼠标移出容错区域
} as const;

// 排除的标签列表（不可拖拽）
export const DEFAULT_EXCLUDED_TAGS = [
  "col",
  "colgroup",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
] as const;
