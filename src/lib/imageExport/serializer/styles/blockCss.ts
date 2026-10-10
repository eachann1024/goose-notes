import type { CardTheme } from "../../themes";

export function buildBlockCss(t: CardTheme): string {
  return `.gooseshot-content code {
  font-family: ${t.codeFont};
  font-size: 0.86em;
  background: ${t.codeBg};
  padding: 2px 6px;
  border-radius: 4px;
  color: ${t.codeTextColor ?? t.textColor};
}
.gooseshot-content pre {
  background: ${t.codeBg};
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${t.tableBorder};
  color: ${t.codeTextColor ?? t.textColor};
}
.gooseshot-content pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  font-family: ${t.codeFont};
  color: inherit;
}
.gooseshot-content .code-block {
  background: ${t.codeBg};
  border-radius: 10px;
  padding: 14px 16px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${t.tableBorder};
  color: ${t.codeTextColor ?? t.textColor};
  font-family: ${t.codeFont};
}
.gooseshot-content .code-lang {
  font-size: 11px;
  color: ${t.secondaryText};
  margin-bottom: 6px;
  font-family: ${t.bodyFont};
  line-height: 1.4;
}
.gooseshot-content .code-summary {
  font-size: 12px;
  color: ${t.secondaryText};
  margin-bottom: 8px;
  font-family: ${t.bodyFont};
}
.gooseshot-content .code-block pre {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}
.gooseshot-content pre.code-wrap,
.gooseshot-content .code-wrap {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}
.gooseshot-content blockquote {
  border-left: 3px solid ${t.quoteBorder};
  padding-left: 18px;
  margin: 16px 0;
  color: ${t.secondaryText};
  font-style: italic;
}
.gooseshot-content img {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin: 16px 0;
}
.gooseshot-content .export-figure { margin: 16px 0; }
.gooseshot-content .export-figure img {
  display: block;
  margin: 0 auto 8px;
  max-width: 100%;
  height: auto;
  border-radius: 10px;
}
.gooseshot-content .export-figure figcaption {
  color: ${t.secondaryText};
  font-size: 0.9em;
  text-align: center;
  line-height: 1.5;
}
.gooseshot-content .file-card {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  background: ${t.calloutBg};
  border: 1px solid ${t.tableBorder};
  border-radius: 10px;
  margin: 14px 0;
}
.gooseshot-content .file-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
.gooseshot-content .file-body { min-width: 0; flex: 1; }
.gooseshot-content .file-name { font-weight: 500; color: ${t.textColor}; }
.gooseshot-content .file-caption {
  font-size: 0.9em;
  color: ${t.secondaryText};
  margin-top: 2px;
}
.gooseshot-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}
.gooseshot-content th, .gooseshot-content td {
  border: 1px solid ${t.tableBorder};
  padding: 8px 12px;
  text-align: left;
}
.gooseshot-content th {
  background: ${t.codeBg};
  font-weight: 600;
  color: ${t.codeTextColor ?? t.textColor};
}
.gooseshot-content .media-fallback {
  color: ${t.secondaryText};
  font-size: 0.95em;
  margin: 12px 0;
}
.gooseshot-content hr {
  border: none;
  border-top: 1px solid ${t.divider};
  margin: 20px 0;
}
.gooseshot-content .callout {
  background: ${t.calloutBg};
  border: 1px solid currentColor;
  border-radius: 10px;
  padding: 14px 18px;
  margin: 14px 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  color: ${t.textColor};
  break-inside: avoid;
}
.gooseshot-content .callout-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  height: ${t.bodyFontSize * t.bodyLineHeight}px;
  display: flex;
  align-items: center;
}
.gooseshot-content .callout-text {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  line-height: ${t.bodyLineHeight};
}
.gooseshot-content .callout-text > .nested-children {
  margin-left: 0;
  margin-top: 0.45em;
}
.gooseshot-content .nested-children {
  margin-left: 22px;
  margin-top: 6px;
}
.gooseshot-content .toggle-summary {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.gooseshot-content .toggle-marker {
  flex-shrink: 0;
  color: ${t.secondaryText};
  line-height: inherit;
}
.gooseshot-content .toggle-children {
  margin-left: 22px;
  margin-top: 6px;
  border-left: 2px solid ${t.divider};
  padding-left: 14px;
}
.gooseshot-content .nested-children > *,
.gooseshot-content .toggle-children > * { margin-bottom: 8px; }
.gooseshot-content .nested-children > *:last-child,
.gooseshot-content .toggle-children > *:last-child { margin-bottom: 0; }
.gooseshot-content .callout-text pre,
.gooseshot-content .nested-children table,
.gooseshot-content .toggle-children table { max-width: 100%; }
`;
}
