import { TEXT_COLORS } from "@/lib/textColors";
/**
 * Mermaid 渲染主题：Neo 外形 + 产品色，去掉默认黄底紫盒。
 */

import type { MermaidConfig } from "mermaid";

export const MERMAID_FONT =
  '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif';

export type MermaidThemeMode = "light" | "dark";

export interface MermaidInitOptions {
  mode: MermaidThemeMode;
  securityLevel?: "strict" | "loose" | "antiscript";
  fontFamily?: string;
  useMaxWidth?: boolean;
}

const LIGHT = {
  background: "transparent",
  primaryColor: "#ffffff",
  primaryTextColor: TEXT_COLORS.light.primary,
  primaryBorderColor: "#e7e5e0",
  secondaryColor: "#eef2ff",
  secondaryTextColor: TEXT_COLORS.light.primary,
  secondaryBorderColor: "#c7d2fe",
  tertiaryColor: "#f7f6f2",
  tertiaryTextColor: TEXT_COLORS.light.secondary,
  tertiaryBorderColor: "#e7e5e0",
  lineColor: "#c4c2ba",
  textColor: TEXT_COLORS.light.primary,
  mainBkg: "#ffffff",
  nodeBorder: "#e7e5e0",
  clusterBkg: "#f7f6f2",
  clusterBorder: "#e7e5e0",
  titleColor: TEXT_COLORS.light.secondary,
  edgeLabelBackground: "#ffffff",
  nodeTextColor: TEXT_COLORS.light.primary,
  actorBkg: "#ffffff",
  actorBorder: "#e7e5e0",
  actorTextColor: TEXT_COLORS.light.primary,
  actorLineColor: "#c4c2ba",
  signalColor: "#5c5b57",
  signalTextColor: TEXT_COLORS.light.primary,
  labelBoxBkgColor: "#f7f6f2",
  labelBoxBorderColor: "#e7e5e0",
  labelTextColor: TEXT_COLORS.light.primary,
  loopTextColor: TEXT_COLORS.light.secondary,
  noteBkgColor: "#eef2ff",
  noteTextColor: TEXT_COLORS.light.secondary,
  noteBorderColor: "#c7d2fe",
  gradientStart: "#ffffff",
  gradientStop: "#f7f6f2",
  useGradient: false,
  dropShadow: "drop-shadow(0 1px 2px rgba(15, 23, 42, 0.08))",
} as const;

const DARK = {
  background: "transparent",
  primaryColor: "#3a3a38",
  primaryTextColor: TEXT_COLORS.dark.primary,
  primaryBorderColor: "#4a4a47",
  secondaryColor: "#312e81",
  secondaryTextColor: TEXT_COLORS.dark.primary,
  secondaryBorderColor: "#4338ca",
  tertiaryColor: "#2e2e2d",
  tertiaryTextColor: TEXT_COLORS.dark.secondary,
  tertiaryBorderColor: "#4a4a47",
  lineColor: "#8a8880",
  textColor: TEXT_COLORS.dark.primary,
  mainBkg: "#3a3a38",
  nodeBorder: "#4a4a47",
  clusterBkg: "#262625",
  clusterBorder: "#4a4a47",
  titleColor: TEXT_COLORS.dark.secondary,
  edgeLabelBackground: "#2e2e2d",
  nodeTextColor: TEXT_COLORS.dark.primary,
  actorBkg: "#3a3a38",
  actorBorder: "#4a4a47",
  actorTextColor: TEXT_COLORS.dark.primary,
  actorLineColor: "#8a8880",
  signalColor: "#c2c0b6",
  signalTextColor: TEXT_COLORS.dark.primary,
  labelBoxBkgColor: "#262625",
  labelBoxBorderColor: "#4a4a47",
  labelTextColor: TEXT_COLORS.dark.primary,
  loopTextColor: TEXT_COLORS.dark.secondary,
  noteBkgColor: "#1e1b4b",
  noteTextColor: TEXT_COLORS.dark.secondary,
  noteBorderColor: "#4338ca",
  gradientStart: "#3a3a38",
  gradientStop: "#2e2e2d",
  useGradient: false,
  dropShadow: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4))",
} as const;

function timelineCss(mode: MermaidThemeMode) {
  const fill = mode === "dark" ? "#3a3a38" : "#ffffff";
  const stroke = mode === "dark" ? "#4a4a47" : "#e7e5e0";
  const text = TEXT_COLORS[mode].primary;
  const axis = mode === "dark" ? "#8a8880" : "#c4c2ba";
  return `
.cluster rect { rx: 14px; ry: 14px; }
.edgeLabel { border-radius: 6px; }
.taskWrapper rect, .eventWrapper rect {
  fill: ${fill} !important;
  stroke: ${stroke} !important;
  stroke-width: 1px !important;
  rx: 10px;
  ry: 10px;
}
.taskWrapper text, .eventWrapper text {
  fill: ${text} !important;
}
.lineWrapper line {
  stroke: ${axis} !important;
  stroke-width: 1.5px !important;
  stroke-dasharray: none !important;
  marker-end: none !important;
}
`;
}

export function getMermaidThemeVariables(mode: MermaidThemeMode) {
  const tokens = mode === "dark" ? DARK : LIGHT;
  return {
    ...tokens,
    darkMode: mode === "dark",
    fontFamily: MERMAID_FONT,
    fontSize: "14px",
  };
}

export function getMermaidInitConfig(options: MermaidInitOptions) {
  const fontFamily = options.fontFamily ?? MERMAID_FONT;
  const useMaxWidth = options.useMaxWidth ?? false;
  return {
    startOnLoad: false,
    theme: options.mode === "dark" ? "neo-dark" : "neo",
    look: "neo",
    darkMode: options.mode === "dark",
    securityLevel: options.securityLevel ?? "strict",
    fontFamily,
    suppressErrorRendering: true,
    themeVariables: {
      ...getMermaidThemeVariables(options.mode),
      fontFamily,
    },
    themeCSS: timelineCss(options.mode),
    timeline: {
      useMaxWidth,
      disableMulticolor: true,
      padding: 24,
      leftMargin: 72,
    },
    flowchart: {
      htmlLabels: true,
      useMaxWidth,
      padding: 18,
      nodeSpacing: 36,
      rankSpacing: 48,
      wrappingWidth: 220,
      curve: "basis",
    },
    sequence: {
      useMaxWidth,
      boxMargin: 8,
      actorMargin: 28,
    },
  } satisfies MermaidConfig;
}

export function stripMermaidInitDirectives(source: string): string {
  return source.replace(/%%\{init:[\s\S]*?\}%%/gi, "").trim();
}
