import type { EChartsOption } from "echarts";
import type { ChartOptionContext } from "./chartOptionContext";

export function createChartBaseOption(
  context: ChartOptionContext,
): EChartsOption {
  const {
    cfg,
    isDark,
    scale,
    t,
    palette,
    multiSeries,
    isCartesian,
    inset,
    titleTop,
    titleFontSize,
    labelFontSize,
    titleOffset,
    isLineLike,
  } = context;
  /* ── base ──────────────────────────────────────────────────────── */
  const option: EChartsOption = {
    backgroundColor: "transparent",
    color: palette,
    textStyle: {
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      color: t.sc,
    },
    // 尊重系统「减少动态效果」偏好
    animation:
      typeof window === "undefined"
        ? true
        : !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    animationDuration: 720,
    animationEasing: "cubicOut",
    animationDurationUpdate: 360,
    title: cfg.title
      ? {
          text: cfg.title,
          left: inset,
          top: titleTop,
          textAlign: "left",
          textStyle: {
            color: t.tc,
            fontSize: titleFontSize,
            fontWeight: 600,
          },
        }
      : undefined,
    tooltip: {
      trigger: isCartesian ? "axis" : "item",
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      borderWidth: 1,
      padding: [Math.round(8 * scale), Math.round(12 * scale)],
      textStyle: {
        color: t.tc,
        fontSize: labelFontSize,
        fontWeight: 500,
      },
      extraCssText: `border-radius:10px;box-shadow:${t.tooltipShadow};backdrop-filter:blur(10px);`,
      axisPointer: isCartesian
        ? {
            type: isLineLike ? "line" : "shadow",
            shadowStyle: { color: t.axisPointer },
            lineStyle: {
              color: isDark ? "rgba(129,140,248,0.45)" : "rgba(79,70,229,0.35)",
              width: 1,
              type: "dashed",
            },
            label: { show: false },
          }
        : undefined,
      // 饼图更友好的百分比
      ...(cfg.type === "pie"
        ? {
            formatter: "{b}<br/>{c}  ·  {d}%",
          }
        : {}),
    },
    legend: multiSeries
      ? {
          // 饼图 legend 放底部更稳；笛卡尔图放标题旁
          ...(cfg.type === "pie"
            ? {
                bottom: Math.round(4 * scale),
                left: "center",
              }
            : {
                top: titleTop + titleOffset - Math.round(2 * scale),
                left: inset,
                right: inset,
              }),
          icon: "circle",
          itemWidth: Math.round(8 * scale),
          itemHeight: Math.round(8 * scale),
          itemGap: Math.round(14 * scale),
          textStyle: {
            color: t.sc,
            fontSize: labelFontSize,
            fontWeight: 500,
          },
          pageTextStyle: { color: t.sc },
        }
      : undefined,
  };

  return option;
}
