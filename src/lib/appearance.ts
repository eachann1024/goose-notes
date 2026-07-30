import {
  EDITOR_FONT_SIZE_DEFAULT,
  type UIFontSize,
} from "@/stores/settings/types";

export const UI_FONT_SIZE_MAP: Record<UIFontSize, number> = {
  small: 14,
  normal: 16,
};

/**
 * 同步写入界面字号与编辑器缩放变量。
 *
 * 启动恢复与用户主动调整共用同一入口：bootstrap 在首个可绘制帧前调用，
 * App 的 effect 在设置变化时重复调用（幂等）。这样冷启动时窗口一出现
 * 就已经处于上次缩放状态，不会先按 100% 布局再跳变。
 */
export function applyAppearanceScaleVariables(options: {
  uiFontSize: UIFontSize;
  editorFontSize: number;
}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const targetUiSize =
    UI_FONT_SIZE_MAP[options.uiFontSize] ?? UI_FONT_SIZE_MAP.small;
  root.style.setProperty("font-size", `${targetUiSize}px`);
  root.style.setProperty("--editor-font-size", `${options.editorFontSize}px`);
  root.style.setProperty(
    "--editor-scale",
    (options.editorFontSize / EDITOR_FONT_SIZE_DEFAULT).toFixed(4),
  );
}

/** 首帧稳定前的标记：存在期间禁用全局过渡，避免内部动画从默认值追赶到恢复值。 */
const STARTUP_SETTLING_ATTR = "data-startup-settling";

export function markStartupSettling(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(STARTUP_SETTLING_ATTR, "");
}

export function clearStartupSettling(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(STARTUP_SETTLING_ATTR);
}

/**
 * 挂载稳定后解除过渡禁用。双 rAF 确保 React 已提交且浏览器完成一次
 * 带恢复状态的绘制，再恢复过渡，用户不会看到追赶动画。
 */
export function releaseStartupSettlingAfterPaint(): void {
  if (typeof requestAnimationFrame === "undefined") {
    clearStartupSettling();
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clearStartupSettling();
    });
  });
}
