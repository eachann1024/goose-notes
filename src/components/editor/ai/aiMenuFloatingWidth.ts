/** 大屏行内 AI 菜单的舒适下限；窄窗（速记小窗）不得超过视口。 */
export const AI_MENU_MIN_WIDTH_PX = 468;
export const AI_MENU_MAX_WIDTH_PX = 1248;
export const AI_MENU_VIEWPORT_RATIO = 0.91;
export const AI_MENU_VIEWPORT_PAD_PX = 8;

export type AiMenuFloatingWidthInput = {
  viewportWidth: number;
  availableWidth: number;
  scale?: number;
};

/**
 * 行内 AI 浮层宽度：大屏保持 91vw（上限 1248、下限 468），
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
  if (viewportCap >= AI_MENU_MIN_WIDTH_PX) {
    return Math.max(AI_MENU_MIN_WIDTH_PX, fitted);
  }
  return Math.max(0, fitted);
}
