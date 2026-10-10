import type { CardTheme } from "../../themes";

function contentHeadingSizes(theme: CardTheme): {
  h1: number;
  h2: number;
  h3: number;
} {
  const body = theme.bodyFontSize;
  return {
    h1: Math.max(
      Math.round(theme.titleFontSize * 0.85),
      Math.round(body * 1.75),
    ),
    h2: Math.max(Math.round(theme.titleFontSize * 0.7), Math.round(body * 1.4)),
    h3: Math.max(
      Math.round(theme.titleFontSize * 0.58),
      Math.round(body * 1.22),
    ),
  };
}

function contentHeadingWeights(theme: CardTheme): {
  h1: number;
  h2: number;
  h3: number;
} {
  const base = theme.titleFontWeight;
  return {
    h1: Math.min(Math.max(base, 600), 900),
    h2: Math.min(Math.max(base - 100, 600), 800),
    h3: Math.min(Math.max(base - 200, 600), 700),
  };
}


export function buildDocumentCss(t: CardTheme, options: { preview?: boolean; decoStyle: string; headerBorder: string; titleStyle: string }): string {
  const { preview, decoStyle, headerBorder, titleStyle } = options;
  const headingSize = contentHeadingSizes(t);
  const headingWeight = contentHeadingWeights(t);
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
${preview ? "html, body { background: transparent; }" : ""}
body {
  font-family: ${t.bodyFont};
  color: ${t.textColor};
  line-height: ${t.bodyLineHeight};
  font-size: ${t.bodyFontSize}px;
  letter-spacing: ${t.bodyLetterSpacing};
}
.gooseshot-container {
  background: ${t.background};
  padding: ${t.containerPaddingY}px ${t.containerPaddingX}px;
  min-width: 680px;
  max-width: 1200px;
  position: relative;
  overflow: hidden;
}
${decoStyle}
.gooseshot-card {
  background: ${t.cardBg};
  border-radius: ${t.cardRadius}px;
  padding: ${t.cardPaddingY}px ${t.cardPaddingX}px;
  box-shadow: ${t.cardShadow};
  position: relative;
  z-index: 1;
  border: ${t.cardBorder};
}
.gooseshot-header { ${headerBorder} }
.gooseshot-title { ${titleStyle} }
.gooseshot-title.has-block-bg,
.gooseshot-content h1[style*="background-color"],
.gooseshot-content h2[style*="background-color"],
.gooseshot-content h3[style*="background-color"] {
  border-radius: 4px;
  padding: 3px 8px;
}
.gooseshot-content p[style*="background-color"],
.gooseshot-content li[style*="background-color"],
.gooseshot-content blockquote[style*="background-color"],
.gooseshot-content .task-item[style*="background-color"],
.gooseshot-content .callout[style*="background-color"],
.gooseshot-content td[style*="background-color"],
.gooseshot-content th[style*="background-color"] {
  border-radius: 4px;
  padding-left: 8px;
  padding-right: 8px;
}
.gooseshot-content > * { margin-bottom: 14px; }
.gooseshot-content > *:last-child { margin-bottom: 0; }
.gooseshot-content h1,
.gooseshot-content h2,
.gooseshot-content h3 {
  font-family: ${t.titleFont};
  color: ${t.textColor};
  letter-spacing: ${t.titleLetterSpacing};
  text-wrap: balance;
}
.gooseshot-content h1 {
  font-size: ${headingSize.h1}px;
  font-weight: ${headingWeight.h1};
  line-height: ${Math.max(t.titleLineHeight, 1.2)};
  margin-top: 28px;
  margin-bottom: 14px;
}
.gooseshot-content h2 {
  font-size: ${headingSize.h2}px;
  font-weight: ${headingWeight.h2};
  line-height: 1.3;
  margin-top: 24px;
  margin-bottom: 12px;
}
.gooseshot-content h3 {
  font-size: ${headingSize.h3}px;
  font-weight: ${headingWeight.h3};
  line-height: 1.35;
  margin-top: 20px;
  margin-bottom: 10px;
}
.gooseshot-content > h1:first-child,
.gooseshot-content > h2:first-child,
.gooseshot-content > h3:first-child { margin-top: 0; }
.gooseshot-content p {
  margin-bottom: 12px;
  line-height: ${t.bodyLineHeight};
}
/* 空段落：占满一行正文高度，避免空行塌缩 */
.gooseshot-content .empty-block {
  min-height: calc(1em * ${t.bodyLineHeight});
  margin-bottom: 12px;
  line-height: ${t.bodyLineHeight};
}
.gooseshot-content p:empty {
  min-height: calc(1em * ${t.bodyLineHeight});
}
.gooseshot-content ul,
.gooseshot-content ol,
.gooseshot-content ul.bn-list,
.gooseshot-content ol.bn-list {
  display: block;
  margin-bottom: 12px;
  padding-inline-start: 1.65em;
  list-style-position: outside;
}
.gooseshot-content ul,
.gooseshot-content ul.bn-list {
  list-style-type: disc;
}
.gooseshot-content ol,
.gooseshot-content ol.bn-list {
  list-style-type: decimal;
}
.gooseshot-content ul > li,
.gooseshot-content ol > li,
.gooseshot-content ul.bn-list > li,
.gooseshot-content ol.bn-list > li {
  display: list-item;
  padding-inline-start: 0.2em;
  margin-bottom: 5px;
  line-height: ${t.bodyLineHeight};
  color: inherit;
  break-inside: avoid;
}
.gooseshot-content ul > li::marker,
.gooseshot-content ul.bn-list > li::marker {
  color: currentColor;
  font-size: 0.82em;
}
.gooseshot-content ol > li::marker,
.gooseshot-content ol.bn-list > li::marker {
  color: currentColor;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.gooseshot-content li > ul,
.gooseshot-content li > ol,
.gooseshot-content li > ul.bn-list,
.gooseshot-content li > ol.bn-list {
  margin-top: 0.35em;
  margin-bottom: 0.2em;
}
`;
}
