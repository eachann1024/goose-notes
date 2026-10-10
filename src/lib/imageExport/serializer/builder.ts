import { buildDocumentCss } from "./styles/documentCss";
import { buildBlockCss } from "./styles/blockCss";
import { buildFooterCss } from "./styles/footerCss";
import type { CardTheme } from "../themes";
import type { WatermarkConfig } from "../watermark";
import { getWatermarkHTML, normalizeWatermarkConfig } from "../watermark";
import { escapeHtml } from "./utils";

function getGoogleFontsUrl(): string {
  const families = [
    "Inter:wght@400;500;600;700;800;900",
    "Noto+Sans+SC:wght@300;400;500;600;700;800;900",
    "Noto+Serif+SC:wght@400;600;700",
    "JetBrains+Mono:wght@400;500",
    "Courier+Prime:wght@400;700",
    "ZCOOL+XiaoWei",
    "Ma+Shan+Zheng",
    // Space Grotesk 最高到 700；更大字重由浏览器合成
    "Space+Grotesk:wght@400;500;600;700",
    "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700",
    "IBM+Plex+Sans:wght@400;500;600",
    "IBM+Plex+Mono:wght@400;500",
  ];
  return `https://fonts.googleapis.com/css2?family=${families.join("&family=")}&display=swap`;
}

export function buildStyledHTML(params: {
  title: string;
  blocksHtml: string;
  theme: CardTheme;
  watermarkConfig?: WatermarkConfig;
  /** 弹层预览用：文档底透明，避免卡片变矮后露出白底。不影响真实导出。 */
  preview?: boolean;
  /** 被提升为首标题的 heading 的 inline CSS（对齐 / 颜色 / 背景） */
  titleInlineStyle?: string;
}): string {
  const { title, blocksHtml, theme } = params;
  const wm = normalizeWatermarkConfig(params.watermarkConfig);
  const t = theme;
  const titleInline = (params.titleInlineStyle || "").trim();
  const titleHasBlockBg = titleInline.includes("background-color");
  const titleInlineAttr = titleInline ? ` style="${titleInline}"` : "";
  const titleClass = titleHasBlockBg
    ? ' class="gooseshot-title has-block-bg"'
    : ' class="gooseshot-title"';
  const decoStyle = t.showDecorations
    ? `
    .gooseshot-container::before {
      content: '';
      position: absolute;
      top: -120px; right: -80px;
      width: 360px; height: 360px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }
    .gooseshot-container::after {
      content: '';
      position: absolute;
      bottom: -100px; left: -60px;
      width: 280px; height: 280px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }`
    : "";

  const titleStyle = `
    font-family: ${t.titleFont};
    font-size: ${t.titleFontSize}px;
    font-weight: ${t.titleFontWeight};
    line-height: ${t.titleLineHeight};
    letter-spacing: ${t.titleLetterSpacing};
    color: ${t.textColor};
    text-align: ${t.titleAlign};
  `;

  const headerBorder =
    "margin-bottom: 24px; padding-bottom: 0; border-bottom: none;";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${getGoogleFontsUrl()}">
<style>
${buildDocumentCss(t, { preview: params.preview, decoStyle, headerBorder, titleStyle })}${buildBlockCss(t)}${buildFooterCss(t)}
</style>
</head>
<body>
<div class="gooseshot-container">
  <div class="gooseshot-card">
    ${
      wm.showTitle
        ? `<div class="gooseshot-header">
      <div${titleClass}${titleInlineAttr}>${escapeHtml(title || "无标题")}</div>
    </div>`
        : ""
    }
    <div class="gooseshot-content">
      ${blocksHtml}
    </div>
    ${getWatermarkHTML(theme, wm)}
  </div>
</div>
</body>
</html>`;
}
