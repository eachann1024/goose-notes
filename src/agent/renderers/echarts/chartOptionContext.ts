import { getPalette } from "./chartPalette";
import { TM } from "./chartThemeTokens";
import type { SimplifiedConfig } from "./chartConfig";

export function createChartOptionContext(
  cfg: SimplifiedConfig,
  isDark: boolean,
  scale: number,
) {
  const series = Array.isArray(cfg.series) ? cfg.series : [];
  const t = isDark ? TM.dark : TM.light;
  const palette = getPalette(isDark);
  const multiSeries = series.length > 1;
  const isCartesian = cfg.type !== "pie";
  const actualType = cfg.type === "area" ? "line" : cfg.type;
  const inset = Math.round(16 * scale);
  const titleTop = Math.round(2 * scale);
  const titleFontSize = Math.max(13, Math.round(14 * scale));
  const labelFontSize = Math.max(11, Math.round(12 * scale));
  const labelSmallFontSize = Math.max(10, Math.round(11 * scale));
  const titleOffset = cfg.title ? Math.round(28 * scale) : 0;
  const legendOffset = multiSeries ? Math.round(26 * scale) : 0;
  const isLineLike = cfg.type === "line" || cfg.type === "area";

  return {
    cfg,
    isDark,
    scale,
    series,
    t,
    palette,
    multiSeries,
    isCartesian,
    actualType,
    inset,
    titleTop,
    titleFontSize,
    labelFontSize,
    labelSmallFontSize,
    titleOffset,
    legendOffset,
    isLineLike,
  };
}

export type ChartOptionContext = ReturnType<typeof createChartOptionContext>;
