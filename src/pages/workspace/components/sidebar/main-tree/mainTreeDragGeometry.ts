import type { DragEvent } from "react";

/** 与 MainTreeItem 行左垫、层级缩进保持一致 */
export const MAIN_TREE_INDENT = 18;
export const MAIN_TREE_ROW_PADDING_LEFT = 6;

/**
 * RCT 2.6.1 对非目录行以 < 0.5 / > 0.5 分上下落点，恰好中心会变成
 * 不允许的 item 目标。仅把这个边界归到下半行，目录中心仍保留拖入语义。
 * 使用库的估高公式，避免整数/半整数行高下修补了错误的坐标。
 */
export function normalizeMainTreeDragOver<T extends HTMLElement>(
  event: DragEvent<T>,
  tree: HTMLElement,
): DragEvent<T> {
  const rows = tree.querySelectorAll<HTMLElement>(
    "[data-rct-item-container='true']",
  );
  const first = rows[0];
  if (!first) return event;
  const style = getComputedStyle(first);
  const height =
    first.offsetHeight +
    Math.max(parseFloat(style.marginTop), parseFloat(style.marginBottom));
  if (!(height > 0)) return event;
  const position = (event.clientY - tree.getBoundingClientRect().top) / height;
  if (position % 1 !== 0.5) return event;
  const marker = rows[Math.floor(position)]?.querySelector(
    "[data-main-tree-folder='false']",
  );
  if (!marker) return event;
  // SyntheticEvent 的 preventDefault 等方法在原型上，不能用对象展开丢掉它们。
  return Object.assign(Object.create(event), { clientY: event.clientY + 0.01 });
}

/** rct 把指示线放在 linearIndex * 估高处；改用真实行顶/底，避免 Electron 逐行累积偏差。 */
export function dropLineTopPx(
  linearIndex: number,
  rowOffsets: number[],
  lastRowHeight: number,
): number {
  if (rowOffsets.length === 0) return 0;
  if (linearIndex < rowOffsets.length) {
    return rowOffsets[linearIndex] ?? 0;
  }
  const last = rowOffsets[rowOffsets.length - 1] ?? 0;
  return last + lastRowHeight;
}
