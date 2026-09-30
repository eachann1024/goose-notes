import {
  closePaneOrTab,
  splitDown,
  splitRight,
  toggleZoom,
} from "@/lib/editor-split/commands";

export type SplitPaletteAction = {
  id: "split-right" | "split-down" | "split-zoom" | "split-close";
  label: string;
  keywords: string;
  shortcutId: "splitRight" | "splitDown" | "splitZoom" | "closeSplitPane";
  run: () => void;
};

/**
 * 命令面板分屏动作。空查询不出现，避免盖住「输入关键词开始搜索」空态。
 * 均分：useEditorSplit 没有 equalize API（仅分隔条双击均分当前组），不暴露。
 */
export const SPLIT_PALETTE_ACTIONS: SplitPaletteAction[] = [
  {
    id: "split-right",
    label: "向右分屏",
    keywords: "分屏 向右 split right pane",
    shortcutId: "splitRight",
    run: () => {
      void splitRight();
    },
  },
  {
    id: "split-down",
    label: "向下分屏",
    keywords: "分屏 向下 split down pane",
    shortcutId: "splitDown",
    run: () => {
      void splitDown();
    },
  },
  {
    id: "split-zoom",
    label: "最大化格",
    keywords: "分屏 最大化 格 zoom pane",
    shortcutId: "splitZoom",
    run: toggleZoom,
  },
  {
    id: "split-close",
    label: "关闭分屏格",
    keywords: "关闭 关格 分屏 close pane",
    shortcutId: "closeSplitPane",
    run: () => {
      closePaneOrTab();
    },
  },
];

export function matchingSplitPaletteActions(
  query: string,
): SplitPaletteAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SPLIT_PALETTE_ACTIONS.filter((action) => {
    const hay = `${action.label} ${action.keywords}`.toLowerCase();
    return hay.includes(q);
  });
}

export function splitPaletteItemValue(action: SplitPaletteAction): string {
  return `split-action-${action.id}`;
}
