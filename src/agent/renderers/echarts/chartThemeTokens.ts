import { TEXT_COLORS } from "@/lib/textColors";

// 与产品编辑器 / HtmlWidget 表面色对齐
export const TM = {
  light: {
    bg: "#ffffff",
    tc: TEXT_COLORS.light.primary,
    sc: TEXT_COLORS.light.secondary,
    muted: TEXT_COLORS.light.secondary,
    gl: "rgba(31,30,29,0.08)",
    glStrong: "rgba(31,30,29,0.14)",
    tooltipBg: "rgba(255,255,255,0.96)",
    tooltipBorder: "rgba(31,30,29,0.08)",
    tooltipShadow:
      "0 10px 28px rgba(15,23,42,0.10), 0 1px 3px rgba(15,23,42,0.06)",
    axisPointer: "rgba(79,70,229,0.08)",
    pieBorder: "#ffffff",
  },
  dark: {
    bg: "#2E2E2D",
    tc: TEXT_COLORS.dark.primary,
    sc: TEXT_COLORS.dark.secondary,
    muted: TEXT_COLORS.dark.secondary,
    gl: "rgba(222,220,209,0.08)",
    glStrong: "rgba(222,220,209,0.14)",
    tooltipBg: "rgba(46,46,45,0.96)",
    tooltipBorder: "rgba(222,220,209,0.12)",
    tooltipShadow: "0 12px 32px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)",
    axisPointer: "rgba(129,140,248,0.12)",
    pieBorder: "#2E2E2D",
  },
};
