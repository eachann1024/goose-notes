import { tool } from "ai";
import { z } from "zod";

/**
 * showTable — 在对话中渲染表格卡片。
 * execute 原样返回 input，UI 层根据 output-available 状态渲染 TableCard。
 */
export const showTable = tool({
  description:
    "在对话里显示一个表格卡片，用于展示结构化数据。列名放在 columns，每行数据对应 rows 里的一个字符串数组。",
  inputSchema: z.object({
    title: z.string().optional().describe("表格标题（可选）"),
    columns: z.array(z.string()).describe("列名列表"),
    rows: z
      .array(z.array(z.string()))
      .describe("数据行，每行长度与 columns 一致"),
  }),
  execute: async (input) => input,
});

/**
 * showChart — 在对话中渲染 ECharts 图表卡片。
 * execute 原样返回 input，UI 层根据 output-available 状态渲染 ChartCard。
 */
export const showChart = tool({
  description:
    "在对话里显示一个图表卡片（折线/柱状/饼图），用于数值对比和趋势分析。",
  inputSchema: z.object({
    type: z
      .enum(["bar", "line", "pie"])
      .describe("图表类型：bar 柱状图、line 折线图、pie 饼图"),
    title: z.string().optional().describe("图表标题（可选）"),
    categories: z
      .array(z.string())
      .optional()
      .describe("X 轴分类标签，饼图时可省略"),
    series: z
      .array(
        z.object({
          name: z.string().describe("系列名称"),
          data: z.array(z.number()).describe("数值列表"),
        }),
      )
      .describe("数据系列，饼图时 data 长度应与 categories 一致"),
  }),
  execute: async (input) => input,
});
