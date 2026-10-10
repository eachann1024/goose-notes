import type { EChartsOption } from "echarts";
import { HEATMAP_LIGHT, HEATMAP_DARK } from "./chartPalette";
import type { ChartOptionContext } from "./chartOptionContext";

export function applyChartAxes(
  option: EChartsOption,
  context: ChartOptionContext,
) {
  const {
    cfg,
    isDark,
    scale,
    series,
    t,
    isCartesian,
    inset,
    labelSmallFontSize,
    titleOffset,
    legendOffset,
    isLineLike,
  } = context;
  /* ── cartesian axes ────────────────────────────────────────────── */
  if (isCartesian && cfg.type !== "heatmap") {
    option.grid = {
      containLabel: true,
      left: inset,
      right: inset,
      top: inset + titleOffset + legendOffset,
      bottom: inset - Math.round(2 * scale),
    };
    option.xAxis = {
      type: "category",
      data: cfg.categories,
      name: cfg.xAxisName,
      nameTextStyle: { color: t.muted, fontSize: labelSmallFontSize },
      nameGap: Math.round(8 * scale),
      boundaryGap: isLineLike ? false : true,
      axisLabel: {
        color: t.muted,
        fontSize: labelSmallFontSize,
        margin: Math.round(10 * scale),
        hideOverlap: true,
      },
      axisLine: {
        show: true,
        lineStyle: { color: t.glStrong, width: 1 },
      },
      axisTick: { show: false },
      splitLine: { show: false },
    };
    option.yAxis = {
      type: "value",
      name: cfg.yAxisName,
      nameTextStyle: { color: t.muted, fontSize: labelSmallFontSize },
      nameGap: Math.round(10 * scale),
      axisLabel: {
        color: t.muted,
        fontSize: labelSmallFontSize,
        margin: Math.round(8 * scale),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: t.gl,
          type: "dashed",
          width: 1,
        },
      },
      splitNumber: 4,
    };
  }

  /* ── heatmap axes & visualMap ──────────────────────────────────── */
  if (cfg.type === "heatmap") {
    option.grid = {
      containLabel: true,
      left: inset,
      right: inset + Math.round(42 * scale),
      top: inset + titleOffset + legendOffset,
      bottom: inset - Math.round(2 * scale),
    };
    option.xAxis = {
      type: "category",
      data: cfg.categories,
      name: cfg.xAxisName,
      nameTextStyle: { color: t.muted, fontSize: labelSmallFontSize },
      axisLabel: { color: t.muted, fontSize: labelSmallFontSize },
      axisLine: { lineStyle: { color: t.glStrong } },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: [t.gl, "transparent"] } },
    };
    option.yAxis = {
      type: "category",
      data: cfg.yCategories,
      name: cfg.yAxisName,
      nameTextStyle: { color: t.muted, fontSize: labelSmallFontSize },
      axisLabel: { color: t.muted, fontSize: labelSmallFontSize },
      axisLine: { lineStyle: { color: t.glStrong } },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: [t.gl, "transparent"] } },
    };

    let vmMin = cfg.visualMap?.min ?? 0;
    let vmMax = cfg.visualMap?.max ?? 100;
    if (cfg.visualMap?.min == null || cfg.visualMap?.max == null) {
      const allValues: number[] = [];
      for (const s of series) {
        for (const d of s.data) {
          const val = Array.isArray(d)
            ? (d as number[])[2]
            : typeof d === "number"
              ? d
              : null;
          if (val != null && Number.isFinite(val)) allValues.push(val);
        }
      }
      if (allValues.length > 0) {
        if (cfg.visualMap?.min == null) vmMin = Math.min(...allValues);
        if (cfg.visualMap?.max == null) vmMax = Math.max(...allValues);
      }
    }

    option.visualMap = {
      min: vmMin,
      max: vmMax,
      calculable: true,
      orient: "vertical",
      right: Math.max(4, Math.round(4 * scale)),
      top: "middle",
      itemWidth: Math.round(10 * scale),
      itemHeight: Math.round(120 * scale),
      textStyle: { color: t.sc, fontSize: labelSmallFontSize },
      inRange: {
        color: isDark ? HEATMAP_DARK : HEATMAP_LIGHT,
      },
    };
  }
}
