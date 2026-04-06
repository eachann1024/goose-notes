import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/stores/useSettings";

const MIN_HEIGHT = 60;
const DEFAULT_HEIGHT = 200;

const HOST_FONTS_CSS = `
@font-face {
  font-family: "Anthropic Sans";
  src: url("https://assets.claude.ai/Fonts/AnthropicSans-Text-Regular-Static.otf") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Anthropic Sans";
  src: url("https://assets.claude.ai/Fonts/AnthropicSans-Text-Medium-Static.otf") format("opentype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Anthropic Serif";
  src: url("https://assets.claude.ai/Fonts/AnthropicSerif-Text-Regular-Static.otf") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Anthropic Serif";
  src: url("https://assets.claude.ai/Fonts/AnthropicSerif-Text-Medium-Static.otf") format("opentype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
`;

const HTML_THEME = {
  light: {
    colorScheme: "light",
    bgPrimary: "#ffffff",
    bgSecondary: "#f5f4ed",
    bgTertiary: "#faf9f5",
    bgInverse: "#141413",
    bgGhost: "rgba(255,255,255,0)",
    bgDisabled: "rgba(255,255,255,0.5)",
    textPrimary: "#141413",
    textSecondary: "#3d3d3a",
    textTertiary: "#73726c",
    textInverse: "#ffffff",
    textGhost: "rgba(115,114,108,.5)",
    textDisabled: "rgba(20,20,19,0.5)",
    borderTertiary: "rgba(31,30,29,.15)",
    borderSecondary: "rgba(31,30,29,.3)",
    borderPrimary: "rgba(31,30,29,.4)",
    borderInverse: "rgba(255,255,255,0.3)",
    borderGhost: "rgba(31,30,29,0)",
    borderInfo: "rgba(70,130,213,1)",
    borderDanger: "rgba(167,61,57,1)",
    borderSuccess: "rgba(67,116,38,1)",
    borderWarning: "rgba(128,92,31,1)",
    borderDisabled: "rgba(31,30,29,0.1)",
    ringPrimary: "rgba(20,20,19,0.7)",
    ringSecondary: "rgba(61,61,58,0.7)",
    ringInverse: "rgba(255,255,255,0.7)",
    ringInfo: "rgba(50,102,173,0.5)",
    ringDanger: "rgba(167,61,57,0.5)",
    ringSuccess: "rgba(67,116,38,0.5)",
    ringWarning: "rgba(128,92,31,0.5)",
    bgInfo: "#d6e4f6",
    textInfo: "#3266ad",
    bgSuccess: "#e9f1dc",
    textSuccess: "#265b19",
    bgWarning: "#f6eedf",
    textWarning: "#5a4815",
    bgDanger: "#f7ecec",
    textDanger: "#7f2c28",
    // color ramp 50 fills (light)
    purple: "#eeedfe",
    teal: "#e1f5ee",
    coral: "#faece7",
    pink: "#fbeaf0",
    blue: "#e6f1fb",
    gray: "#f1efe8",
    green: "#eaf3de",
    amber: "#faeeda",
    red: "#fcebeb",
    // color ramp 600 strokes (light)
    purpleStroke: "#534ab7",
    tealStroke: "#0f6e56",
    coralStroke: "#993c1d",
    pinkStroke: "#993556",
    blueStroke: "#185fa5",
    grayStroke: "#5f5e5a",
    greenStroke: "#3b6d11",
    amberStroke: "#854f0b",
    redStroke: "#a32d2d",
    // color ramp 800 text heading (light)
    purpleTextH: "#3c3489",
    tealTextH: "#085041",
    coralTextH: "#712b13",
    pinkTextH: "#72243e",
    blueTextH: "#0c447c",
    grayTextH: "#444441",
    greenTextH: "#27500a",
    amberTextH: "#633806",
    redTextH: "#791f1f",
    // color ramp 600 text sub (light) — same as stroke
    purpleTextS: "#534ab7",
    tealTextS: "#0f6e56",
    coralTextS: "#993c1d",
    pinkTextS: "#993556",
    blueTextS: "#185fa5",
    grayTextS: "#5f5e5a",
    greenTextS: "#3b6d11",
    amberTextS: "#854f0b",
    redTextS: "#a32d2d",
  },
  dark: {
    colorScheme: "dark",
    bgPrimary: "#302e2e",
    bgSecondary: "#262624",
    bgTertiary: "#141413",
    bgInverse: "#faf9f5",
    bgGhost: "rgba(48,48,46,0)",
    bgDisabled: "rgba(48,48,46,0.5)",
    textPrimary: "#faf9f5",
    textSecondary: "#c2c0b6",
    textTertiary: "#9c9a92",
    textInverse: "#141413",
    textGhost: "rgba(156,154,146,.5)",
    textDisabled: "rgba(250,249,245,0.5)",
    borderTertiary: "rgba(222,220,209,.15)",
    borderSecondary: "rgba(222,220,209,.3)",
    borderPrimary: "rgba(222,220,209,.4)",
    borderInverse: "rgba(20,20,19,0.15)",
    borderGhost: "rgba(222,220,209,0)",
    borderInfo: "rgba(70,130,213,1)",
    borderDanger: "rgba(205,92,88,1)",
    borderSuccess: "rgba(89,145,48,1)",
    borderWarning: "rgba(168,120,41,1)",
    borderDisabled: "rgba(222,220,209,0.1)",
    ringPrimary: "rgba(250,249,245,0.7)",
    ringSecondary: "rgba(194,192,182,0.7)",
    ringInverse: "rgba(20,20,19,0.7)",
    ringInfo: "rgba(128,170,221,0.5)",
    ringDanger: "rgba(205,92,88,0.5)",
    ringSuccess: "rgba(89,145,48,0.5)",
    ringWarning: "rgba(168,120,41,0.5)",
    bgInfo: "#253e5f",
    textInfo: "#80aade",
    bgSuccess: "#1b4614",
    textSuccess: "#7ab948",
    bgWarning: "#483a0f",
    textWarning: "#d1a041",
    bgDanger: "#602a28",
    textDanger: "#ee8884",
    // color ramp 800 fills (dark)
    purple: "#3c3489",
    teal: "#085041",
    coral: "#712b13",
    pink: "#72243e",
    blue: "#0c447c",
    gray: "#444441",
    green: "#27500a",
    amber: "#633806",
    red: "#791f1f",
    // color ramp 200 strokes (dark)
    purpleStroke: "#afa9ec",
    tealStroke: "#5dcaa5",
    coralStroke: "#f0997b",
    pinkStroke: "#ed93b1",
    blueStroke: "#85b7eb",
    grayStroke: "#b4b2a9",
    greenStroke: "#97c459",
    amberStroke: "#ef9f27",
    redStroke: "#f09595",
    // color ramp 100 text heading (dark)
    purpleTextH: "#cecbf6",
    tealTextH: "#9fe1cb",
    coralTextH: "#f5c4b3",
    pinkTextH: "#f4c0d1",
    blueTextH: "#b5d4f4",
    grayTextH: "#d3d1c7",
    greenTextH: "#c0dd97",
    amberTextH: "#fac775",
    redTextH: "#f7c1c1",
    // color ramp 200 text sub (dark) — same as stroke
    purpleTextS: "#afa9ec",
    tealTextS: "#5dcaa5",
    coralTextS: "#f0997b",
    pinkTextS: "#ed93b1",
    blueTextS: "#85b7eb",
    grayTextS: "#b4b2a9",
    greenTextS: "#97c459",
    amberTextS: "#ef9f27",
    redTextS: "#f09595",
  },
} as const;

function buildDesignSystemCss(isDark: boolean) {
  const t = isDark ? HTML_THEME.dark : HTML_THEME.light;

  const ramps = ["purple","teal","coral","pink","blue","gray","green","amber","red"] as const;
  const colorRampCss = ramps.map(name => {
    const fill = t[name];
    const stroke = t[`${name}Stroke` as keyof typeof t];
    const textH = t[`${name}TextH` as keyof typeof t];
    const textS = t[`${name}TextS` as keyof typeof t];
    return `
g.c-${name} > rect, g.c-${name} > ellipse, g.c-${name} > circle, g.c-${name} > polygon,
rect.c-${name}, ellipse.c-${name}, circle.c-${name}, polygon.c-${name} {
  fill: ${fill}; stroke: ${stroke};
}
.c-${name} > .th, .c-${name} > .t { fill: ${textH}; }
.c-${name} > .ts { fill: ${textS}; }`;
  }).join("\n");

  return `
:root {
  color-scheme: ${t.colorScheme};
  --font-sans: "Anthropic Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Anthropic Serif", Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, monospace;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-text-xs-size: 12px;
  --font-text-sm-size: 14px;
  --font-text-md-size: 16px;
  --font-text-lg-size: 20px;
  --font-text-xs-line-height: 1.4;
  --font-text-sm-line-height: 1.4;
  --font-text-md-line-height: 1.4;
  --font-text-lg-line-height: 1.25;
  --color-background-primary: ${t.bgPrimary};
  --color-background-secondary: ${t.bgSecondary};
  --color-background-tertiary: ${t.bgTertiary};
  --color-background-inverse: ${t.bgInverse};
  --color-background-ghost: ${t.bgGhost};
  --color-background-disabled: ${t.bgDisabled};
  --color-background-info: ${t.bgInfo};
  --color-background-success: ${t.bgSuccess};
  --color-background-warning: ${t.bgWarning};
  --color-background-danger: ${t.bgDanger};
  --color-text-primary: ${t.textPrimary};
  --color-text-secondary: ${t.textSecondary};
  --color-text-tertiary: ${t.textTertiary};
  --color-text-inverse: ${t.textInverse};
  --color-text-ghost: ${t.textGhost};
  --color-text-disabled: ${t.textDisabled};
  --color-text-info: ${t.textInfo};
  --color-text-success: ${t.textSuccess};
  --color-text-warning: ${t.textWarning};
  --color-text-danger: ${t.textDanger};
  --color-border-primary: ${t.borderPrimary};
  --color-border-secondary: ${t.borderSecondary};
  --color-border-tertiary: ${t.borderTertiary};
  --color-border-inverse: ${t.borderInverse};
  --color-border-ghost: ${t.borderGhost};
  --color-border-info: ${t.borderInfo};
  --color-border-danger: ${t.borderDanger};
  --color-border-success: ${t.borderSuccess};
  --color-border-warning: ${t.borderWarning};
  --color-border-disabled: ${t.borderDisabled};
  --color-ring-primary: ${t.ringPrimary};
  --color-ring-secondary: ${t.ringSecondary};
  --color-ring-inverse: ${t.ringInverse};
  --color-ring-info: ${t.ringInfo};
  --color-ring-danger: ${t.ringDanger};
  --color-ring-success: ${t.ringSuccess};
  --color-ring-warning: ${t.ringWarning};
  --p: var(--color-text-primary);
  --s: var(--color-text-secondary);
  --t: var(--color-text-tertiary);
  --bg2: var(--color-background-secondary);
  --b: var(--color-border-secondary);
  --border-radius-xs: 4px;
  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 10px;
  --border-radius-xl: 12px;
  --border-radius-full: 9999px;
  --border-width-regular: 0.5px;
  --shadow-hairline: 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
input, select, textarea, button { font-family: inherit; }
html, body {
  scrollbar-width: thin;
}
html::-webkit-scrollbar, body::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,0.35);
  border-radius: 3px;
}
html::-webkit-scrollbar-track, body::-webkit-scrollbar-track {
  background: transparent;
}
body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  background: transparent;
  color: var(--color-text-primary);
  padding: 0;
  margin: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
}
h1, h2, h3, h4, h5, h6 { color: var(--color-text-primary); }
h1 { font-size: 22px; font-weight: 500; }
h2 { font-size: 18px; font-weight: 500; }
h3 { font-size: 16px; font-weight: 500; }
label { font-size: 13px; color: var(--color-text-secondary); display: block; margin-bottom: 4px; }
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), select, textarea {
  font-family: inherit;
  font-size: 16px;
  padding: 8px 12px;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-sm);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  width: 100%;
  height: 36px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
textarea {
  height: auto;
  min-height: 80px;
  resize: vertical;
}
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):hover, select:hover, textarea:hover {
  border-color: var(--color-border-secondary);
}
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):focus, select:focus, textarea:focus {
  border-color: var(--color-border-info);
  box-shadow: 0 0 0 3px var(--color-background-info);
}
select { cursor: pointer; }
button {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 16px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background .15s, transform .1s;
}
button:hover { background: var(--color-background-secondary); }
button:active { background: var(--color-border-tertiary); transform: scale(0.98); }
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"};
  border: none;
  padding: 0;
  outline: none;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  cursor: pointer;
  transition: border-color .15s, transform .15s;
}
input[type=range]:hover::-webkit-slider-thumb { border-color: var(--color-border-primary); transform: scale(1.1); }
input[type=range]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  cursor: pointer;
}
#vis-container {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.6vw, 16px);
  min-width: 0;
  overflow: visible;
}
#vis-container > * {
  max-width: 100%;
  min-width: 0;
}
#vis-container > svg {
  display: block;
  margin-inline: 0;
  width: 100%;
  max-width: 100%;
  height: auto;
  overflow: visible;
}
#vis-container > :where(section, article, .viz-module) {
  width: 100%;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: calc(var(--border-radius-xl) + 2px);
  background: transparent;
  padding: clamp(12px, 1.8vw, 18px);
  overflow: visible;
}
#vis-container > :where(section, article, .viz-module, .tab-content) > * + * {
  margin-top: clamp(10px, 1.6vw, 16px);
}
#vis-container > :where(section, article, .viz-module) > :last-child {
  margin-bottom: 0;
}
#vis-container > .tab-bar,
#vis-container > .nav-pills {
  margin-bottom: 0;
  padding-inline: 4px;
}
#vis-container > .tab-content {
  width: 100%;
  min-width: 0;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: calc(var(--border-radius-xl) + 2px);
  background: transparent;
  padding: clamp(12px, 1.8vw, 18px);
  overflow: visible;
}
#vis-container :where(svg, canvas, img, table) {
  max-width: 100%;
}
#vis-container :where(.overflow-auto, .overflow-x-auto, .overflow-y-auto) {
  overflow: visible !important;
  overflow-x: visible !important;
  overflow-y: visible !important;
  max-height: none !important;
  height: auto !important;
}
#vis-container :is(
  [style*="overflow:auto"],
  [style*="overflow: auto"],
  [style*="overflow-y:auto"],
  [style*="overflow-y: auto"],
  [style*="overflow-x:auto"],
  [style*="overflow-x: auto"]
) {
  overflow: visible !important;
  overflow-x: visible !important;
  overflow-y: visible !important;
  max-height: none !important;
  height: auto !important;
}
/* flex / grid 布局工具（AI 生成 HTML 可直接使用） */
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-wrap { flex-wrap: wrap; }
.flex-1 { flex: 1 1 0; }
.grow { flex-grow: 1; }
.shrink-0 { flex-shrink: 0; }
.basis-0 { flex-basis: 0; }
.flex-none { flex: none; }
.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-6 { gap: 24px; }
.gap-8 { gap: 32px; }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
/* spacing */
.p-2 { padding: 8px; }
.p-3 { padding: 12px; }
.p-4 { padding: 16px; }
.p-6 { padding: 24px; }
.px-2 { padding-left: 8px; padding-right: 8px; }
.px-3 { padding-left: 12px; padding-right: 12px; }
.px-4 { padding-left: 16px; padding-right: 16px; }
.py-2 { padding-top: 8px; padding-bottom: 8px; }
.py-3 { padding-top: 12px; padding-bottom: 12px; }
.py-4 { padding-top: 16px; padding-bottom: 16px; }
.m-0 { margin: 0; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
/* sizing */
.w-full { width: 100%; }
.max-w-full { max-width: 100%; }
.min-w-0 { min-width: 0; }
.min-h-0 { min-height: 0; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
/* typography */
.text-sm { font-size: 12px; }
.text-base { font-size: 14px; }
.text-lg { font-size: 16px; }
.text-xl { font-size: 18px; }
.font-medium { font-weight: 500; }
.font-bold { font-weight: 500; } /* 遵守设计规范，最大500 */
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-secondary { color: var(--color-text-secondary); }
.text-tertiary { color: var(--color-text-tertiary); }
/* borders & radius */
.rounded { border-radius: var(--border-radius-md); }
.rounded-lg { border-radius: var(--border-radius-lg); }
.border { border: 0.5px solid var(--color-border-secondary); }
.border-tertiary { border: 0.5px solid var(--color-border-tertiary); }
/* backgrounds */
.bg-secondary { background: var(--color-background-secondary); }
.bg-info { background: var(--color-background-info); }
.text-info { color: var(--color-text-info); }
.bg-success { background: var(--color-background-success); }
.text-success { color: var(--color-text-success); }
.bg-warning { background: var(--color-background-warning); }
.text-warning { color: var(--color-text-warning); }
.bg-danger { background: var(--color-background-danger); }
.text-danger { color: var(--color-text-danger); }
/* cursor & overflow */
.cursor-pointer { cursor: pointer; }
.overflow-hidden { overflow: hidden; }
.overflow-auto { overflow: auto; }
.overflow-x-auto { overflow-x: auto; }
.overflow-y-auto { overflow-y: auto; }
/* display */
.hidden { display: none; }
.block { display: block; }
.inline-block { display: inline-block; }
/* position */
.relative { position: relative; }
.absolute { position: absolute; }
.sticky { position: sticky; }
/* transition */
.transition { transition: all 0.15s ease; }
/* Heading margins inside vis-container (global * reset kills them otherwise) */
#vis-container h1 { font-size: 22px; font-weight: 600; line-height: 1.3; margin-bottom: 1rem; }
#vis-container h2 { font-size: 18px; font-weight: 500; margin-bottom: 0.75rem; }
#vis-container h3 { font-size: 15px; font-weight: 500; margin-bottom: 0.5rem; }
#vis-container h4, #vis-container h5, #vis-container h6 { margin-bottom: 0.4rem; }
/* Card internal spacing */
.card > * + * { margin-top: 8px; }
/* reference semantic classes */
.gallery { display: flex; flex-direction: column; gap: 1.5rem; padding: 0; }
.section-title { font-size: 18px; font-weight: 500; margin-bottom: 12px; color: var(--color-text-primary); }
.section-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px; line-height: 1.6; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 12px; align-items: stretch; }
.card {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  overflow: hidden;
  height: 100%;
}
.card:hover { border-color: var(--color-border-secondary); }
.card-label { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; letter-spacing: .02em; }
.card-icon {
  font-size: 24px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
}
.card-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin: 0 0 4px; }
.card-sub { font-size: 11px; color: var(--color-text-secondary); line-height: 1.4; margin: 0; }
.metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(148px, 100%), 1fr)); gap: 12px; margin-bottom: 0; align-items: stretch; }
.metric { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 12px 16px; height: 100%; }
.metric-label { font-size: 12px; color: var(--color-text-secondary); }
.metric-val { font-size: 22px; font-weight: 500; margin-top: 6px; }
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: var(--border-radius-md);
}
.badge-info { background: var(--color-background-info); color: var(--color-text-info); }
.badge-success { background: var(--color-background-success); color: var(--color-text-success); }
.badge-warning { background: var(--color-background-warning); color: var(--color-text-warning); }
.badge-danger { background: var(--color-background-danger); color: var(--color-text-danger); }
.tab-bar { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: none; margin-bottom: 12px; }
.tab {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-full);
  background: var(--color-background-secondary);
  transition: all .2s;
}
.tab.active {
  color: var(--color-text-primary);
  border-color: var(--color-border-secondary);
  background: var(--color-background-primary);
  box-shadow: var(--shadow-sm);
  font-weight: 500;
}
.tab:hover { color: var(--color-text-primary); border-color: var(--color-border-secondary); }
.tab-content { display: none; min-width: 0; overflow: visible; }
.tab-content.active { display: flex; flex-direction: column; gap: 12px; }
.compare-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 12px; align-items: stretch; }
.compare-card {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
  height: 100%;
}
.compare-card.featured { border: 2px solid var(--color-border-info); }
.compare-name { font-size: 16px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 6px; }
.compare-price { font-size: 24px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 8px; }
.compare-feat { font-size: 13px; line-height: 1.7; color: var(--color-text-secondary); }
.record { display: flex; align-items: center; gap: 12px; }
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-info);
  color: var(--color-text-info);
  font-weight: 500;
  flex: none;
}
.record-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
.record-role { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.nav-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.pill {
  padding: 6px 10px;
  border-radius: var(--border-radius-full);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  cursor: pointer;
  transition: all .15s;
}
.pill.active { background: var(--color-text-primary); color: var(--color-text-inverse); }
.btn-row { display: flex; gap: 10px; margin-top: 16px; }
.divider { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 1.5rem 0; }
.ic-blue { background: var(--color-background-info); color: var(--color-text-info); }
.ic-green { background: var(--color-background-success); color: var(--color-text-success); }
.ic-amber { background: var(--color-background-warning); color: var(--color-text-warning); }
.ic-red { background: var(--color-background-danger); color: var(--color-text-danger); }
.ic-purple { background: ${t.purple}; color: ${t.purpleStroke}; }
.leader { stroke: var(--t); stroke-width: 0.5; stroke-dasharray: 4 3; fill: none; }
.t { font-size: 14px; fill: var(--p); }
.ts { font-size: 12px; fill: var(--s); }
.th { font-size: 14px; font-weight: 500; fill: var(--p); }
.box { fill: var(--bg2); stroke: var(--b); stroke-width: 0.5; }
.arr { stroke: var(--t); fill: none; stroke-width: 1.5; }
.node { cursor: pointer; }
.node:hover rect, .node:hover .box { filter: brightness(0.97); }
.node:hover text { opacity: 0.8; }
${colorRampCss}
/* Mermaid / ER diagram skin */
svg.classDiagram,
svg.erDiagram {
  font-size: 13px;
  max-width: 100%;
  height: auto;
}
svg.classDiagram foreignObject,
svg.erDiagram foreignObject {
  overflow: visible;
}
svg.classDiagram foreignObject > div,
svg.erDiagram foreignObject > div {
  max-width: none !important;
}
svg.classDiagram .nodeLabel,
svg.erDiagram .nodeLabel,
svg.classDiagram .label foreignObject div,
svg.erDiagram .label foreignObject div {
  font-family: var(--font-sans) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--color-text-secondary) !important;
}
svg.classDiagram .label-group .nodeLabel,
svg.erDiagram .name .nodeLabel {
  font-size: 14px !important;
  font-weight: 500 !important;
  color: var(--color-text-primary) !important;
}
svg.classDiagram .label-group .label {
  font-weight: 500 !important;
}
svg.classDiagram .edgeLabel,
svg.classDiagram .edgeLabel span,
svg.classDiagram .edgeTerminals foreignObject div,
svg.erDiagram .edgeLabel,
svg.erDiagram .edgeLabel span {
  font-size: 11px !important;
  color: var(--color-text-tertiary) !important;
}
svg.classDiagram .node path[stroke]:not([stroke="none"]),
svg.classDiagram .divider path,
svg.erDiagram .node path[stroke]:not([stroke="none"]),
svg.erDiagram .divider path {
  stroke: var(--color-border-tertiary) !important;
  stroke-width: 0.5px !important;
  fill: none !important;
}
svg.classDiagram .node .basic path[fill]:not([fill="none"]) {
  fill: var(--color-background-primary) !important;
  stroke: none !important;
  stroke-width: 0 !important;
}
svg.erDiagram .node > g:first-child > path[fill]:not([fill="none"]) {
  fill: var(--color-background-secondary) !important;
}
svg.erDiagram .row-rect-odd path[fill]:not([fill="none"]) {
  fill: var(--color-background-primary) !important;
}
svg.erDiagram .row-rect-even path[fill]:not([fill="none"]) {
  fill: var(--color-background-secondary) !important;
}
svg.erDiagram .relationshipLine,
svg.classDiagram .relation {
  stroke: var(--color-text-tertiary) !important;
  stroke-width: 1px !important;
}
svg.classDiagram .marker,
svg.classDiagram marker path,
svg.erDiagram .marker,
svg.erDiagram marker path {
  stroke: var(--color-text-tertiary) !important;
  stroke-width: 1px !important;
}
svg.classDiagram marker path[fill]:not([fill="none"]):not([fill="transparent"]),
svg.erDiagram marker path[fill]:not([fill="none"]):not([fill="transparent"]) {
  fill: var(--color-text-tertiary) !important;
}
svg.classDiagram .labelBkg,
svg.erDiagram .labelBkg {
  background-color: var(--color-background-primary) !important;
  opacity: 1 !important;
}
${isDark ? buildDarkModeInlineOverrides() : ""}
`;
}

/**
 * 深色模式下，对 AI 生成 HTML 里常见的硬编码浅色 inline style 进行覆盖。
 * 使用属性选择器匹配 style 属性中的常见字符串片段。
 */
function buildDarkModeInlineOverrides(): string {
  // 常见白色 / 浅色背景值列表
  const lightBgs = [
    "white", "#fff", "#ffffff",
    "#f8f9fa", "#f9f9f9", "#f7f7f7",
    "#f5f5f5", "#f4f4f4", "#f3f4f6",
    "#fafafa", "#faf9f5", "#f1f1f1",
    "#ebebeb", "#e8e8e8", "#eee", "#eeeeee",
    "rgb(255,255,255)", "rgb(255, 255, 255)",
    "rgba(255,255,255,1)", "rgba(255, 255, 255, 1)",
  ];
  // 常见黑色 / 深灰文字值
  const darkTexts = [
    "black", "#000", "#000000",
    "#111", "#111111", "#1a1a1a",
    "#222", "#222222", "#1f2937",
    "#333", "#333333", "#111827",
  ];
  // 中间灰文字（映射到 secondary）
  const midTexts = [
    "#444", "#444444", "#4b5563",
    "#555", "#555555",
    "#666", "#666666", "#6b7280",
    "#777", "#777777", "#374151",
    "#888", "#888888",
    "rgb(100,100,100)", "rgb(80,80,80)",
  ];
  // 常见浅色边框
  const lightBorders = [
    "#ddd", "#dddddd",
    "#ccc", "#cccccc",
    "#e5e5e5", "#e5e7eb",
    "#d1d5db", "#d0d0d0",
    "rgb(229,229,229)", "rgb(200,200,200)",
  ];

  const bgSelectors = (values: string[], prop: "background" | "background-color") =>
    values.flatMap(v => [`[style*="${prop}:${v}"]`, `[style*="${prop}: ${v}"]`]).join(",\n");

  const colorSelectors = (values: string[]) =>
    values.flatMap(v => [`[style*="color:${v}"]`, `[style*="color: ${v}"]`]).join(",\n");

  const borderSelectors = (values: string[]) =>
    values.flatMap(v => [
      `[style*="border-color:${v}"]`, `[style*="border-color: ${v}"]`,
      `[style*="border:0.5px solid ${v}"]`, `[style*="border: 0.5px solid ${v}"]`,
      `[style*="border:1px solid ${v}"]`, `[style*="border: 1px solid ${v}"]`,
    ]).join(",\n");

  return `
/* ── Dark-mode: neutralise hardcoded light backgrounds ──────────── */
:is(
${bgSelectors(lightBgs, "background")},
${bgSelectors(lightBgs, "background-color")}
) {
  background: var(--color-background-primary) !important;
  background-color: var(--color-background-primary) !important;
}
/* ── Dark-mode: neutralise hardcoded dark text ───────────────────── */
:is(
${colorSelectors(darkTexts)}
) {
  color: var(--color-text-primary) !important;
}
:is(
${colorSelectors(midTexts)}
) {
  color: var(--color-text-secondary) !important;
}
/* ── Dark-mode: neutralise hardcoded light borders ───────────────── */
:is(
${borderSelectors(lightBorders)}
) {
  border-color: var(--color-border-secondary) !important;
}
`;
}

const RESIZE_SCRIPT = `<script>
(() => {
  const container = document.getElementById('vis-container');
  let rafId = 0;
  let settleTimer = 0;

  function normalizeTopLevelHeadingModules() {
    if (!container) return;
    const blocks = Array.from(container.children).filter((child) =>
      child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE'
    );
    const hasExplicitModules = blocks.some((child) =>
      child.classList.contains('viz-module') ||
      child.hasAttribute('data-viz-module') ||
      child.tagName === 'SECTION' ||
      child.tagName === 'ARTICLE'
    );
    const TAB_CLASS_RE = /\btab(s|[-_](bar|nav|list|header|content|panel|pane|body|wrapper|container|buttons?|controls?))?\b/i;
    const hasTabLayout =
      !!document.querySelector('[role="tab"],[role="tabpanel"],[role="tablist"]') ||
      blocks.some((child) =>
        TAB_CLASS_RE.test(child.className) ||
        child.classList.contains('nav-pills') ||
        child.classList.contains('nav-tabs') ||
        Array.from(child.querySelectorAll('[role="tab"],[role="tabpanel"]')).length > 0
      );
    const headingCount = blocks.filter((child) => /^H[1-6]$/.test(child.tagName)).length;

    if (hasExplicitModules || hasTabLayout || headingCount < 2) return;

    let currentModule = null;
    blocks.forEach((block) => {
      if (/^H[1-6]$/.test(block.tagName)) {
        currentModule = document.createElement('section');
        currentModule.className = 'viz-module';
        container.insertBefore(currentModule, block);
      }
      currentModule?.appendChild(block);
    });
  }

  function readHeight() {
    const bodyTop = document.body.getBoundingClientRect().top;
    const directChildren = container ? Array.from(container.children) : [];
    const childrenBottom = directChildren.reduce((max, child) => {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return max;
      const rect = child.getBoundingClientRect();
      return Math.max(max, rect.bottom - bodyTop);
    }, 0);

    return Math.ceil(Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.scrollHeight,
      document.body.offsetHeight,
      container ? container.scrollHeight : 0,
      childrenBottom
    ));
  }

  function notifyHeight() {
    window.parent.postMessage({ type: 'iframe-height', height: readHeight() }, '*');
  }

  function scheduleHeight() {
    window.cancelAnimationFrame(rafId);
    window.clearTimeout(settleTimer);
    rafId = window.requestAnimationFrame(() => {
      notifyHeight();
      settleTimer = window.setTimeout(notifyHeight, 120);
    });
  }

  normalizeTopLevelHeadingModules();
  window.__gooseWidgetResize = scheduleHeight;
  window.addEventListener('load', scheduleHeight);
  window.addEventListener('resize', scheduleHeight);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleHeight).catch(() => {});
  }

  ['click', 'input', 'change', 'transitionend', 'animationend'].forEach((eventName) => {
    document.addEventListener(eventName, scheduleHeight, true);
  });

  const mutationObserver = new MutationObserver(scheduleHeight);
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(scheduleHeight);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
    if (container) resizeObserver.observe(container);
  }

  document.addEventListener('keydown', (event) => {
    if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.repeat) return;
    const isZoomKey =
      event.key === '+' ||
      event.key === '=' ||
      event.key === '-' ||
      event.key === '0' ||
      event.code === 'Equal' ||
      event.code === 'Minus' ||
      event.code === 'Digit0' ||
      event.code === 'NumpadAdd' ||
      event.code === 'NumpadSubtract' ||
      event.code === 'Numpad0';

    if (isZoomKey) {
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        { type: 'iframe-editor-zoom', key: event.key, code: event.code },
        '*'
      );
    }
  }, true);

  window.setTimeout(scheduleHeight, 40);
  window.setTimeout(scheduleHeight, 140);
  window.setTimeout(scheduleHeight, 320);
})();
<\/script>`;

export interface HtmlWidgetBlockProps {
  html: string;
}

export const HtmlWidgetBlock = React.memo(
  React.forwardRef<HTMLDivElement, HtmlWidgetBlockProps>(
    function HtmlWidgetBlock({ html }, ref) {
      const theme = useSettings((state) => state.theme);
      const increaseEditorFontSize = useSettings((state) => state.increaseEditorFontSize);
      const decreaseEditorFontSize = useSettings((state) => state.decreaseEditorFontSize);
      const resetEditorFontSize = useSettings((state) => state.resetEditorFontSize);
      const [height, setHeight] = useState(DEFAULT_HEIGHT);
      const iframeRef = useRef<HTMLIFrameElement>(null);

      const isDark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      const srcdoc = useMemo(() => {
        const colorSchemeMeta = `<meta name="color-scheme" content="${isDark ? "dark" : "light"}">`;
        return `<!DOCTYPE html><html><head><meta charset="utf-8">${colorSchemeMeta}<style>${HOST_FONTS_CSS}</style><style>${buildDesignSystemCss(isDark)}</style></head><body><div id="vis-container">${html}</div>${RESIZE_SCRIPT}</body></html>`;
      }, [html, isDark]);

      const iframeKey = useMemo(() => {
        let hash = 0;
        for (let i = 0; i < html.length; i++) {
          hash = ((hash << 5) - hash + html.charCodeAt(i)) | 0;
        }
        return `html-widget-${isDark ? "dark" : "light"}-${hash}`;
      }, [html, isDark]);

      const handleMessage = useCallback(
        (event: MessageEvent) => {
          if (
            !event.data ||
            typeof event.data !== "object" ||
            event.source !== iframeRef.current?.contentWindow
          ) {
            return;
          }

          if (
            event.data.type === "iframe-height" &&
            typeof event.data.height === "number"
          ) {
            const clamped = Math.max(MIN_HEIGHT, event.data.height);
            setHeight(clamped);
            return;
          }

          if (
            event.data.type === "iframe-editor-zoom" &&
            (typeof event.data.key === "string" || typeof event.data.code === "string")
          ) {
            const key = typeof event.data.key === "string" ? event.data.key : "";
            const code = typeof event.data.code === "string" ? event.data.code : "";

            if (
              key === "+" ||
              key === "=" ||
              code === "Equal" ||
              code === "NumpadAdd"
            ) {
              increaseEditorFontSize();
            } else if (
              key === "-" ||
              code === "Minus" ||
              code === "NumpadSubtract"
            ) {
              decreaseEditorFontSize();
            } else if (
              key === "0" ||
              code === "Digit0" ||
              code === "Numpad0"
            ) {
              resetEditorFontSize();
            }
          }
        },
        [decreaseEditorFontSize, increaseEditorFontSize, resetEditorFontSize],
      );

      useEffect(() => {
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
      }, [handleMessage]);

      useEffect(() => {
        setHeight(DEFAULT_HEIGHT);
      }, [iframeKey]);

      return (
        <div ref={ref}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            allowTransparency={true}
            style={{
              border: "none",
              width: "100%",
              height: `${height}px`,
              display: "block",
              background: "transparent",
            }}
          />
        </div>
      );
    },
  ),
);
