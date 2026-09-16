/** 与 MainTreeItem 行左垫、层级缩进保持一致 */
export const MAIN_TREE_INDENT = 18;
export const MAIN_TREE_ROW_PADDING_LEFT = 6;

export interface TreeRowDropInfo {
  id: string;
  isFolder: boolean;
  parentId: string | undefined;
  top: number;
  bottom: number;
}

/**
 * 本地文件夹没有自定义排序：落点只决定「放进哪个目录」。
 * 目录行 → 该目录；文件行 → 其所在目录；空白处用指针上方最后一行同样规则。
 */
export function resolveLocalFolderDropParentId(
  hovered: TreeRowDropInfo | null,
  fallbackAbove: TreeRowDropInfo | null,
): string | undefined {
  const row = hovered ?? fallbackAbove;
  if (!row) return undefined;
  return row.isFolder ? row.id : row.parentId;
}

export function findRowAtY(
  rows: TreeRowDropInfo[],
  y: number,
): TreeRowDropInfo | null {
  return rows.find((row) => y >= row.top && y < row.bottom) ?? null;
}

export function findLastRowAboveY(
  rows: TreeRowDropInfo[],
  y: number,
): TreeRowDropInfo | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && row.top <= y) return row;
  }
  return null;
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

/**
 * 本地文件夹落线是否隐藏：只有同目录内的拖动才会改变顺序（落点 = 插入位置），
 * 其余落点（落在行上 / 落到别的目录）都只是「把条目移进某个目录」，
 * 顺序由名称排序或手动顺序末尾决定，画落线反而误导。
 */
export function shouldHideLocalFolderSortLine({
  nestParent,
  draggedParentId,
  isBetweenItems,
}: {
  /** 本次拖动将要落进的目录（captured 优先，否则 rct 给的 parentItem） */
  nestParent: string | undefined | null;
  /** 被拖条目当前所在目录；无拖动中条目时 undefined */
  draggedParentId: string | undefined;
  isBetweenItems: boolean;
}): boolean {
  if (!isBetweenItems) return true;
  const targetDirId =
    nestParent === "root" ? undefined : (nestParent ?? undefined);
  return targetDirId !== draggedParentId;
}
