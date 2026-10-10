import type { EChartsOption } from "echarts";
import { getPalette } from "./chartPalette";
import { TM } from "./chartThemeTokens";

/**
 * 给原生 ECharts option 注入统一主题色与基础 tooltip（不破坏用户自定义 series）。
 */
export function polishRawOption(
  raw: EChartsOption,
  isDark: boolean,
): EChartsOption {
  const t = isDark ? TM.dark : TM.light;
  const palette = getPalette(isDark);
  const rawTooltip =
    typeof raw.tooltip === "object" && raw.tooltip ? raw.tooltip : {};
  return {
    ...raw,
    color: raw.color ?? palette,
    backgroundColor: "transparent",
    textStyle: {
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      color: t.sc,
      ...(raw.textStyle as object),
    },
    animation: raw.animation ?? true,
    animationDuration: raw.animationDuration ?? 720,
    animationEasing: raw.animationEasing ?? "cubicOut",
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: t.tc, fontSize: 12, fontWeight: 500 },
      extraCssText: `border-radius:10px;box-shadow:${t.tooltipShadow};backdrop-filter:blur(10px);`,
      ...rawTooltip,
    },
  } as EChartsOption;
}
