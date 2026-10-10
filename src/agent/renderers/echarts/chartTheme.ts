import type { EChartsOption } from "echarts";
import type { SimplifiedConfig } from "./chartConfig";
import { createChartOptionContext } from "./chartOptionContext";
import { createChartBaseOption } from "./chartBaseOption";
import { applyChartAxes } from "./chartAxes";
import { createChartSeries } from "./chartSeries";

export * from "./chartConfig";
export { TM } from "./chartThemeTokens";
export { polishRawOption } from "./polishRawOption";

export function buildOption(
  cfg: SimplifiedConfig,
  isDark: boolean,
  scale: number,
): EChartsOption {
  const context = createChartOptionContext(cfg, isDark, scale);
  const option = createChartBaseOption(context);
  applyChartAxes(option, context);
  option.series = createChartSeries(context);
  return option;
}
