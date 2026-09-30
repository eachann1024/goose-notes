/**
 * Tab 内并排卡片分屏。侧栏 / AI 面板不进这棵树。
 *
 * - `horizontal`：左右并排（Cmd+D，新格在右，左叶 pageId 不变）
 * - `vertical`：上下叠放（Cmd+Shift+D，新格在下）
 */

export const MAX_SPLIT_LEAVES = 4;

/** 分屏列标记（量宽 / 样式钩子）。 */
export const EDITOR_SPLIT_COLUMN_ATTR = "data-editor-split-column";

export type SplitGroupOrientation = "horizontal" | "vertical";

/** 用户发起的分屏方向。 */
export type SplitDirection = "right" | "down";

/** 焦点邻格方向（几何邻接，不是创建顺序）。 */
export type SplitNeighborDirection = "left" | "right" | "up" | "down";

export type SplitLeaf = {
  kind: "leaf";
  id: string;
  pageId: string;
  /** 无障碍标题；未设时 UI 用 pageId。接线方可写入页面名。 */
  title?: string;
};

export type SplitGroup = {
  kind: "group";
  id: string;
  orientation: SplitGroupOrientation;
  children: SplitNode[];
  /** 与 children 等长的百分比，合计 100。 */
  sizes: number[];
};

export type SplitNode = SplitLeaf | SplitGroup;

export type SplitState = {
  root: SplitNode;
  focusedLeafId: string;
  /** 非 null 时该叶占满，其它叶隐藏；不改树结构。 */
  zoomedLeafId: string | null;
};

/**
 * 接线：在 `splitFocused` 前由调用方创建同本空白页。
 * 常规笔记本用 `usePages.createPage`；本地文件夹用 `createUnsavedLocalPage`。
 */
export type SplitCreateBlankPage = () => string;

export type SplitLeafSuccess = {
  ok: true;
  state: SplitState;
  newLeafId: string;
};

export type SplitLeafFailure = {
  ok: false;
  error: string;
  state: SplitState;
};

export type SplitLeafResult = SplitLeafSuccess | SplitLeafFailure;

export type CloseLeafResult =
  | { kind: "updated"; state: SplitState }
  | { kind: "last-pane"; state: SplitState };

export type SplitFocusedInput = {
  tabId: string;
  direction: SplitDirection;
  newPageId: string;
};

export type SplitFocusedResult =
  | {
      ok: true;
      newLeafId: string;
      newPageId: string;
    }
  | { ok: false; error: string };

export type CloseFocusedResult =
  | { kind: "updated"; focusedPageId: string | null }
  | { kind: "last-pane" };
