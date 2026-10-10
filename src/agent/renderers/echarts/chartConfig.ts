export const CHART_MIN_HEIGHT = 220;
export const CHART_MAX_HEIGHT = 620;

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "heatmap";

export const KNOWN_TYPES = new Set<ChartType>([
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "heatmap",
]);

export interface SimplifiedConfig {
  type: ChartType;
  title?: string;
  categories?: string[];
  yCategories?: string[];
  xAxisName?: string;
  yAxisName?: string;
  series: { name: string; data: unknown[] }[];
  visualMap?: { min?: number; max?: number };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseConfig(
  raw: Record<string, unknown>,
): SimplifiedConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type as string | undefined;
  if (!type || !KNOWN_TYPES.has(type as ChartType)) return null;
  const series = raw.series;
  if (!Array.isArray(series) || series.length === 0) return null;
  return raw as unknown as SimplifiedConfig;
}

/**
 * 检测 AI 是否输出了原生 ECharts option（而非我们的简化格式）。
 * 原生格式：没有 root type，series 数组的每项有 type 字段。
 */
export function isRawEChartsOption(raw: Record<string, unknown>): boolean {
  if (!raw || typeof raw !== "object") return false;
  const series = raw.series;
  if (!Array.isArray(series) || series.length === 0) return false;
  return (
    typeof (series[0] as Record<string, unknown>)?.type === "string" ||
    "xAxis" in raw ||
    "yAxis" in raw
  );
}
export function hasRenderableChartSeries(
  series: unknown,
): series is { name: string; data: unknown[] }[] {
  return Array.isArray(series) && series.length > 0;
}
export function getPreferredChartHeight(
  rawConfig: Record<string, unknown>,
  width: number,
  scale: number,
) {
  const minHeight = Math.round(CHART_MIN_HEIGHT * scale);
  const maxHeight = Math.round(CHART_MAX_HEIGHT * scale);
  const safeWidth = Math.max(width, 320);
  const parsed = parseConfig(rawConfig);

  if (!parsed) {
    return clamp(
      Math.round(240 * scale) + Math.round(Math.min(safeWidth, 720) * 0.12),
      minHeight,
      Math.round(420 * scale),
    );
  }

  const titleExtra = parsed.title ? Math.round(26 * scale) : 0;
  const legendExtra = parsed.series.length > 1 ? Math.round(24 * scale) : 0;

  switch (parsed.type) {
    case "pie":
      return clamp(
        Math.round(260 * scale) + titleExtra + legendExtra,
        minHeight,
        Math.round(440 * scale),
      );
    case "scatter":
      return clamp(
        Math.round(250 * scale) +
          Math.round(Math.min(safeWidth, 880) * 0.08) +
          titleExtra +
          legendExtra,
        minHeight,
        Math.round(460 * scale),
      );
    case "heatmap": {
      const rowCount = parsed.yCategories?.length ?? 0;
      const columnCount = parsed.categories?.length ?? 0;
      const baseHeight =
        Math.round(170 * scale) +
        rowCount * Math.round(22 * scale) +
        Math.min(columnCount, 10) * Math.round(2 * scale) +
        titleExtra +
        legendExtra;
      return clamp(baseHeight, Math.round(260 * scale), maxHeight);
    }
    default: {
      const categoryCount = parsed.categories?.length ?? 0;
      const seriesExtra =
        Math.max(0, parsed.series.length - 1) * Math.round(8 * scale);
      return clamp(
        Math.round(220 * scale) +
          titleExtra +
          legendExtra +
          Math.min(categoryCount, 12) * Math.round(9 * scale) +
          seriesExtra,
        minHeight,
        Math.round(420 * scale),
      );
    }
  }
}
