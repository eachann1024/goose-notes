import type { SeriesOption } from "echarts";
import { echarts } from "./registerEcharts";
import { getSeriesColor, hexToRgba } from "./chartPalette";
import { TM } from "./chartThemeTokens";
import { areaGradient, barGradient } from "./chartGradients";
import type { ChartOptionContext } from "./chartOptionContext";

export function createChartSeries(context: ChartOptionContext): SeriesOption[] {
  const {
    cfg,
    isDark,
    scale,
    series,
    t,
    multiSeries,
    actualType,
    labelSmallFontSize,
  } = context;
  /* ── series ────────────────────────────────────────────────────── */
  return series.map((s, i) => {
    const color = getSeriesColor(i, isDark);
    const base: Record<string, unknown> = {
      name: s.name,
      data: s.data,
      type: actualType,
      animationDelay: (idx: number) => idx * 18 + i * 40,
    };

    if (cfg.type === "bar") {
      base.barMaxWidth = Math.round((multiSeries ? 28 : 40) * scale);
      base.barMinWidth = Math.round(6 * scale);
      base.barGap = "28%";
      base.barCategoryGap = "42%";
      base.itemStyle = {
        color: barGradient(color, isDark),
        borderRadius: multiSeries
          ? [Math.round(4 * scale), Math.round(4 * scale), 0, 0]
          : [Math.round(7 * scale), Math.round(7 * scale), 0, 0],
      };
      base.emphasis = {
        focus: "series",
        itemStyle: {
          shadowBlur: 12,
          shadowColor: hexToRgba(color, 0.35),
          shadowOffsetY: 3,
        },
      };
    }

    if (cfg.type === "line" || cfg.type === "area") {
      base.smooth = 0.35;
      base.symbol = "circle";
      base.symbolSize = Math.max(5, Math.round(6 * scale));
      // 多系列默认隐藏点，悬停再显示；单系列同样
      base.showSymbol = false;
      base.lineStyle = {
        width: Math.max(2, Math.round((multiSeries ? 2 : 2.5) * scale)),
        color,
        shadowColor: hexToRgba(color, multiSeries ? 0.12 : 0.25),
        shadowBlur: multiSeries ? 3 : 6,
        shadowOffsetY: multiSeries ? 1 : 2,
      };
      base.itemStyle = {
        color,
        borderColor: isDark ? TM.dark.bg : "#ffffff",
        borderWidth: 2,
      };
      base.emphasis = {
        focus: "series",
        scale: true,
        itemStyle: {
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: hexToRgba(color, 0.4),
        },
      };
      if (cfg.type === "area") {
        // 多系列面积降低不透明度，避免叠成泥
        base.areaStyle = {
          color: multiSeries
            ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: hexToRgba(color, 0.18) },
                { offset: 1, color: hexToRgba(color, 0.02) },
              ])
            : areaGradient(color),
          origin: "start",
        };
      } else if (!multiSeries) {
        // 单系列折线也给极轻面积，避免「光秃线」
        base.areaStyle = {
          color: areaGradient(color),
          opacity: 0.85,
        };
      }
    }

    if (cfg.type === "pie") {
      const isMultiRing = multiSeries;
      base.radius = isMultiRing
        ? [`${30 + i * 14}%`, `${42 + i * 14}%`]
        : ["44%", "70%"];
      base.center = ["50%", cfg.title || multiSeries ? "54%" : "50%"];
      base.padAngle = 2;
      base.minShowLabelAngle = 8;
      base.itemStyle = {
        borderRadius: Math.round(7 * scale),
        borderColor: t.pieBorder,
        borderWidth: Math.round(2.5 * scale),
      };
      base.label = {
        color: t.sc,
        fontSize: labelSmallFontSize,
        fontWeight: 500,
        formatter: "{b}\n{d}%",
        lineHeight: Math.round(16 * scale),
      };
      base.labelLine = {
        length: Math.round(12 * scale),
        length2: Math.round(8 * scale),
        smooth: 0.2,
        lineStyle: { color: t.glStrong, width: 1 },
      };
      base.emphasis = {
        scale: true,
        scaleSize: 6,
        itemStyle: {
          shadowBlur: 16,
          shadowColor: "rgba(0,0,0,0.18)",
        },
        label: {
          fontWeight: 600,
          color: t.tc,
        },
      };
      base.animationType = "scale";
      base.animationEasing = "cubicOut";
      // 中心留白更干净的环形；单环时不塞文字，避免拥挤
      if (!isMultiRing && i === 0) {
        base.avoidLabelOverlap = true;
      }
    }

    if (cfg.type === "scatter") {
      base.symbolSize = Math.max(8, Math.round(9 * scale));
      base.itemStyle = {
        color: hexToRgba(color, 0.78),
        borderColor: color,
        borderWidth: 1.5,
        shadowBlur: 6,
        shadowColor: hexToRgba(color, 0.25),
      };
      base.emphasis = {
        focus: "series",
        scale: 1.2,
        itemStyle: {
          shadowBlur: 12,
          shadowColor: hexToRgba(color, 0.4),
        },
      };
    }

    if (cfg.type === "heatmap") {
      base.label = {
        show: true,
        color: t.tc,
        fontSize: labelSmallFontSize,
        fontWeight: 500,
      };
      base.itemStyle = {
        borderColor: isDark ? "rgba(46,46,45,0.65)" : "rgba(255,255,255,0.85)",
        borderWidth: 1.5,
        borderRadius: 3,
      };
      base.emphasis = {
        itemStyle: {
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.2)",
        },
      };
    }

    return base as SeriesOption;
  });
}
