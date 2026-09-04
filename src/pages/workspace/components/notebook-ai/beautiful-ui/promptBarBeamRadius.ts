/** 与 Composer 外壳 `rounded-[20px]` 对齐 */
export const PROMPT_BAR_EXPANDED_RADIUS = 20;

/**
 * SVG `<rect>` 的 rx/ry 会按宽、高各自钳制：两边都写超大值时，
 * 实际变成 rx=宽/2、ry=高/2，整圈是椭圆。
 * CSS `rounded-full` 则是两端正圆的胶囊。这里按外壳圆角算 beam 内沿半径。
 */
export function promptBarBeamRadius({
  width,
  height,
  expanded,
  inset = 1,
}: {
  width: number;
  height: number;
  expanded: boolean;
  inset?: number;
}): number {
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  const maxCorner = Math.min(innerW, innerH) / 2;
  const outerRadius = expanded
    ? PROMPT_BAR_EXPANDED_RADIUS
    : Math.min(width, height) / 2;
  return Math.min(maxCorner, Math.max(0, outerRadius - inset));
}
