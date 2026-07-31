import type { AccentColor } from "@/stores/settings/types";

/**
 * 将强调色交给静态 CSS preset 解析。这里只写一个稳定属性，明暗模式切换
 * 由 :root/.dark 选择器自动完成，不在运行时计算或拼装颜色。
 */
export function applyAccentColor(accentColor: AccentColor): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-goose-accent", accentColor);
}
