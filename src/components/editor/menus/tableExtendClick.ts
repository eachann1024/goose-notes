/** 小于这个位移仍算点击加一行/列，避免鼠标微抖把 + 当成拖拽、结果什么都不加。 */
export const TABLE_EXTEND_CLICK_SLOP_PX = 4;

export function isTableExtendPointerClick(
  movementPx: number,
  slopPx = TABLE_EXTEND_CLICK_SLOP_PX,
) {
  return Math.abs(movementPx) < slopPx;
}
