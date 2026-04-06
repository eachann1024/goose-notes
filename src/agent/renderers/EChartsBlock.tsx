import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { EDITOR_FONT_SIZE_DEFAULT, useSettings } from "@/stores/useSettings";

/* ── colour system (from dataviz skill) ─────────────────────────── */
const PALETTE = [
  "#7c6bf0",
  "#3ca1a1",
  "#e06c4c",
  "#4a90d9",
  "#8bbb46",
  "#d9a032",
  "#d35db3",
  "#6a9fcf",
];

const TM = {
  light: { bg: "#ffffff", tc: "#141413", sc: "#3d3d3a", gl: "rgba(31,30,29,.06)" },
  dark: { bg: "#302e2e", tc: "#faf9f5", sc: "#c2c0b6", gl: "rgba(222,220,209,.08)" },
};

const CHART_MIN_HEIGHT = 220;
const CHART_MAX_HEIGHT = 620;

/* ── helpers ─────────────────────────────────────────────────────── */

type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "heatmap";

const KNOWN_TYPES = new Set<ChartType>(["bar", "line", "area", "pie", "scatter", "heatmap"]);

interface SimplifiedConfig {
  type: ChartType;
  title?: string;
  categories?: string[];
  yCategories?: string[];
  xAxisName?: string;
  yAxisName?: string;
  series: { name: string; data: unknown[] }[];
  visualMap?: { min?: number; max?: number };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseConfig(raw: Record<string, unknown>): SimplifiedConfig | null {
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
function isRawEChartsOption(raw: Record<string, unknown>): boolean {
  if (!raw || typeof raw !== "object") return false;
  const series = raw.series;
  if (!Array.isArray(series) || series.length === 0) return false;
  // 原生格式：series[0].type 存在，或 xAxis/yAxis 存在
  return (
    typeof (series[0] as Record<string, unknown>)?.type === "string" ||
    "xAxis" in raw ||
    "yAxis" in raw
  );
}

function buildOption(
  cfg: SimplifiedConfig,
  isDark: boolean,
  scale: number,
): echarts.EChartsOption {
  const t = isDark ? TM.dark : TM.light;
  const multiSeries = cfg.series.length > 1;
  const isCartesian = cfg.type !== "pie";
  const actualType = cfg.type === "area" ? "line" : cfg.type;
  const inset = Math.round(18 * scale);
  const titleTop = Math.round(4 * scale);
  const titleFontSize = Math.max(13, Math.round(14 * scale));
  const labelFontSize = Math.max(11, Math.round(12 * scale));
  const labelSmallFontSize = Math.max(10, Math.round(11 * scale));
  const titleOffset = cfg.title ? Math.round(30 * scale) : 0;
  const legendOffset = multiSeries ? Math.round(28 * scale) : 0;

  /* ── base ──────────────────────────────────────────────────────── */
  const option: echarts.EChartsOption = {
    backgroundColor: "transparent",
    color: PALETTE,
    title: cfg.title
      ? {
          text: cfg.title,
          left: inset,
          top: titleTop,
          textAlign: "left",
          textStyle: { color: t.tc, fontSize: titleFontSize, fontWeight: 600 },
        }
      : undefined,
    tooltip: {
      trigger: isCartesian ? "axis" : "item",
      backgroundColor: isDark ? "#3a3838" : "#fff",
      borderColor: isDark ? "#504e4e" : "#e5e5e5",
      textStyle: { color: t.tc, fontSize: labelFontSize },
      padding: [Math.round(6 * scale), Math.round(8 * scale)],
    },
    legend: multiSeries
      ? {
          top: titleTop + titleOffset - Math.round(2 * scale),
          left: inset,
          right: inset,
          textStyle: { color: t.sc, fontSize: labelFontSize },
        }
      : undefined,
  };

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
      nameTextStyle: { color: t.sc },
      axisLabel: { color: t.sc, fontSize: labelSmallFontSize },
      axisLine: { lineStyle: { color: t.gl } },
      axisTick: { lineStyle: { color: t.gl } },
    };
    option.yAxis = {
      type: "value",
      name: cfg.yAxisName,
      nameTextStyle: { color: t.sc },
      axisLabel: { color: t.sc, fontSize: labelSmallFontSize },
      splitLine: { lineStyle: { color: t.gl } },
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
      nameTextStyle: { color: t.sc },
      axisLabel: { color: t.sc, fontSize: labelSmallFontSize },
      axisLine: { lineStyle: { color: t.gl } },
      axisTick: { lineStyle: { color: t.gl } },
      splitArea: { show: true },
    };
    option.yAxis = {
      type: "category",
      data: cfg.yCategories,
      name: cfg.yAxisName,
      nameTextStyle: { color: t.sc },
      axisLabel: { color: t.sc, fontSize: labelSmallFontSize },
      axisLine: { lineStyle: { color: t.gl } },
      axisTick: { lineStyle: { color: t.gl } },
      splitArea: { show: true },
    };

    // Compute visualMap min/max from data if not provided
    let vmMin = cfg.visualMap?.min ?? 0;
    let vmMax = cfg.visualMap?.max ?? 100;
    if (cfg.visualMap?.min == null || cfg.visualMap?.max == null) {
      const allValues: number[] = [];
      for (const s of cfg.series) {
        for (const d of s.data) {
          const val = Array.isArray(d) ? (d as number[])[2] : typeof d === "number" ? d : null;
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
        color: isDark
          ? ["#2a1f5e", "#7c6bf0", "#c8bfff"]
          : ["#eee8ff", "#7c6bf0", "#3b2d80"],
      },
    };
  }

  /* ── series ────────────────────────────────────────────────────── */
  option.series = cfg.series.map((s, i) => {
    const base: Record<string, unknown> = {
      name: s.name,
      data: s.data,
      type: actualType,
    };

    if (cfg.type === "area") {
      base.areaStyle = { opacity: 0.12 };
    }

    if (cfg.type === "pie") {
      base.radius = multiSeries ? [`${28 + i * 14}%`, `${43 + i * 14}%`] : ["0%", "72%"];
      base.center = ["50%", cfg.title || multiSeries ? "56%" : "50%"];
      base.label = { color: t.sc, fontSize: labelSmallFontSize };
    }

    if (cfg.type === "scatter") {
      base.symbolSize = Math.max(7, Math.round(8 * scale));
    }

    if (cfg.type === "heatmap") {
      base.label = { show: true, color: t.tc, fontSize: labelSmallFontSize };
    }

    return base as echarts.SeriesOption;
  });

  return option;
}

function getPreferredChartHeight(
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
        Math.round(240 * scale) + titleExtra + legendExtra,
        minHeight,
        Math.round(420 * scale),
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
      const seriesExtra = Math.max(0, parsed.series.length - 1) * Math.round(8 * scale);
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

/* ── component ──────────────────────────────────────────────────── */

export interface EChartsBlockProps {
  config: Record<string, unknown>;
}

export const EChartsBlock = React.memo(
  React.forwardRef<HTMLDivElement, EChartsBlockProps>(({ config }, ref) => {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [frameWidth, setFrameWidth] = useState(0);
    const theme = useSettings((state) => state.theme);
    const editorFontSize = useSettings((state) => state.editorFontSize);

    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const editorScale = editorFontSize / EDITOR_FONT_SIZE_DEFAULT;
    const framePadding = Math.round(clamp(12 * editorScale, 10, 18));
    const contentWidth = Math.max(frameWidth - framePadding * 2, 0);
    const chartHeight = useMemo(
      () => getPreferredChartHeight(config, contentWidth, editorScale),
      [config, contentWidth, editorScale],
    );
    const parsedConfig = useMemo(() => parseConfig(config), [config]);
    const useRaw = useMemo(
      () => !parsedConfig && isRawEChartsOption(config),
      [config, parsedConfig],
    );
    const option = useMemo(() => {
      if (parsedConfig) {
        return {
          backgroundColor: "transparent",
          color: PALETTE,
          ...buildOption(parsedConfig, isDark, editorScale),
        } satisfies echarts.EChartsOption;
      }

      if (useRaw) {
        return {
          backgroundColor: "transparent",
          color: PALETTE,
          ...(config as echarts.EChartsOption),
        } satisfies echarts.EChartsOption;
      }

      return null;
    }, [config, editorScale, isDark, parsedConfig, useRaw]);

    /* forward ref while keeping internal ref */
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref],
    );

    useEffect(() => {
      const frame = frameRef.current;
      if (!frame) return;

      const updateWidth = () => {
        setFrameWidth(frame.clientWidth);
      };

      updateWidth();

      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(frame);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      if (!option) {
        setError("无法解析图表配置");
        if (chartRef.current) {
          chartRef.current.dispose();
          chartRef.current = null;
        }
        return;
      }

      setError(null);

      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }

      try {
        const instance = echarts.init(el, isDark ? "dark" : undefined, {
          renderer: "canvas",
        });
        instance.setOption(option, true);
        chartRef.current = instance;
      } catch (e) {
        setError(e instanceof Error ? e.message : "图表渲染失败");
        chartRef.current = null;
      }

      return () => {
        if (chartRef.current) {
          chartRef.current.dispose();
          chartRef.current = null;
        }
      };
    }, [isDark, option]);

    useEffect(() => {
      const instance = chartRef.current;
      const el = containerRef.current;
      if (!instance || !el) return;
      instance.resize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    }, [chartHeight, contentWidth, editorScale]);

    if (error) {
      return (
        <div
          ref={frameRef}
          style={{
            width: "100%",
            padding: `${framePadding}px`,
          }}
        >
          <div
            ref={setRefs}
            style={{
              minHeight: Math.max(96, Math.round(108 * editorScale)),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDark ? TM.dark.sc : TM.light.sc,
              fontSize: Math.max(13, Math.round(13 * editorScale)),
              opacity: 0.7,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={frameRef}
        style={{
          width: "100%",
          padding: `${framePadding}px ${framePadding}px ${Math.max(framePadding, 12)}px`,
        }}
      >
        <div
          ref={setRefs}
          style={{ width: "100%", height: chartHeight, background: "transparent" }}
        />
      </div>
    );
  }),
);

EChartsBlock.displayName = "EChartsBlock";
