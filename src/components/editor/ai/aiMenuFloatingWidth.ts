/** 行内 AI 紧凑浮卡；窄窗和分屏不得超过可用空间。 */
export const AI_MENU_MIN_WIDTH_PX = 280;
export const AI_MENU_MAX_WIDTH_PX = 420;
export const AI_MENU_VIEWPORT_RATIO = 1;
export const AI_MENU_VIEWPORT_PAD_PX = 8;

export type AiMenuFloatingWidthInput = {
  viewportWidth: number;
  availableWidth: number;
  scale?: number;
};

/**
 * 行内 AI 浮层宽度：最大宽 420px，
 * 小窗按视口与 Floating UI 可用宽度收缩，避免撑破 320–480 速记窗。
 */
export function computeAiMenuFloatingWidth({
  viewportWidth,
  availableWidth,
  scale = 1,
}: AiMenuFloatingWidthInput): number {
  const pad = AI_MENU_VIEWPORT_PAD_PX;
  const safeScale = Math.max(scale, 0.5);
  const viewportCap = Math.max(0, viewportWidth - pad * 2);
  const desired = Math.min(
    viewportWidth * AI_MENU_VIEWPORT_RATIO,
    AI_MENU_MAX_WIDTH_PX,
    viewportCap,
  );
  const available = availableWidth / safeScale - pad;
  const fitted = Math.min(
    desired,
    Number.isFinite(available) && available > 0 ? available : desired,
    viewportCap,
  );
  return Math.max(0, fitted);
}
