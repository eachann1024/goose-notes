import { documentTextColors } from "@/lib/textColors";

/** BlockNote 命名颜色 —— 必须与 BlockNote CSS 中定义的颜色名一致 */
export const TEXT_COLORS = [
  { name: "默认", color: "default" },
  { name: "灰色", color: "gray" },
  { name: "褐色", color: "brown" },
  { name: "红色", color: "red" },
  { name: "橙色", color: "orange" },
  { name: "黄色", color: "yellow" },
  { name: "绿色", color: "green" },
  { name: "蓝色", color: "blue" },
  { name: "紫色", color: "purple" },
  { name: "粉色", color: "pink" },
];

export const HIGHLIGHT_COLORS = [
  { name: "无背景", color: "default" },
  { name: "灰色背景", color: "gray" },
  { name: "褐色背景", color: "brown" },
  { name: "红色背景", color: "red" },
  { name: "橙色背景", color: "orange" },
  { name: "黄色背景", color: "yellow" },
  { name: "绿色背景", color: "green" },
  { name: "蓝色背景", color: "blue" },
  { name: "紫色背景", color: "purple" },
  { name: "粉色背景", color: "pink" },
];

/**
 * 颜色名 → CSS 颜色值。
 * 文字预览在笔记本和速记中共用全局色表；背景预览保留各入口现有色带。
 */
const previewColor = (token: string, fallback: string) =>
  typeof __GOOSE_LITE__ !== "undefined" && __GOOSE_LITE__
    ? fallback
    : `var(${token}, ${fallback})`;

export const COLOR_PREVIEW: Record<string, string> = Object.fromEntries(
  Object.entries(documentTextColors("light")).map(([name, fallback]) => [
    name,
    `var(--goose-editor-highlight-${name}-text, ${fallback})`,
  ]),
);

export const BG_PREVIEW: Record<string, string> = {
  gray: previewColor("--goose-editor-highlight-gray-bg", "#ebeced"),
  brown: previewColor("--goose-editor-highlight-brown-bg", "#e9e5e3"),
  red: previewColor("--goose-editor-highlight-red-bg", "#fbe4e4"),
  orange: previewColor("--goose-editor-highlight-orange-bg", "#f6e9d9"),
  yellow: previewColor("--goose-editor-highlight-yellow-bg", "#fbf3db"),
  green: previewColor("--goose-editor-highlight-green-bg", "#ddedea"),
  blue: previewColor("--goose-editor-highlight-blue-bg", "#ddebf1"),
  purple: previewColor("--goose-editor-highlight-purple-bg", "#eae4f2"),
  pink: previewColor("--goose-editor-highlight-pink-bg", "#f4dfeb"),
};

export const MIXED = "__mixed__";
