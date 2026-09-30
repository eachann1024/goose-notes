/** 与 Composer 外壳 `rounded-control` 对齐；单行、多行同一圆角 */
export const PROMPT_BAR_RADIUS = 8;

/**
 * SVG `<rect>` 的 rx/ry 会按宽、高各自钳制：两边都写超大值时，
 * 实际变成 rx=宽/2、ry=高/2，整圈是椭圆。
 * 优先使用外壳的实际圆角，按同一圆角算 beam 内沿半径。
 */
export function promptBarBeamRadius({
  width,
  height,
  inset = 1,
  radius = PROMPT_BAR_RADIUS,
}: {
  width: number;
  height: number;
  inset?: number;
  radius?: number;
}): number {
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  const maxCorner = Math.min(innerW, innerH) / 2;
  return Math.min(maxCorner, Math.max(0, radius - inset));
}
