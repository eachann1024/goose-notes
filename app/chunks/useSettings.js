const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./svgToPng.js","./rolldown-runtime.js","./vendor-blocknote.js","./vendor-react.js","./vendor-prosemirror.js","../assets/vendor-blocknote.css","./vendor-katex~katex.js","./export.js","./prepareExportBlocks.js","./file-system.js","./utils.js","./exportHtmlDocument.js","./vendor.js","./vendor-ui.js","./vendor-export~index~export~index~webdavSync~react-pdf.browser~schema~blocknote-xl-pdf-exporter.js","./vendor-markdown.js","./vendor-katex~index~export~index~webdavSync.js","../assets/vendor.css","./schema.js","./sonner.js","./mermaid.js","./imageProcessor.js","./shell.js","./blockPropsMarker.js","./usePages.js","./utools.js","./local-md-snapshot.js","./utoolsDbStorage.js"])))=>i.map(i=>d[i]);
import{r as e}from"./rolldown-runtime.js";import{c as t,l as n,u as r}from"./vendor-react.js";import{a as i}from"./utoolsDbStorage.js";import{A as a,C as o,D as s,E as c,G as l,K as u,N as d,O as f,P as p,S as m,T as h,U as ee,W as te,_ as g,a as ne,b as _,c as v,d as y,f as re,g as ie,h as ae,j as oe,k as b,m as se,n as x,p as ce,q as le,u as ue,v as de,w as fe,x as pe,y as me}from"./sonner.js";import{Pt as he}from"./vendor-blocknote.js";import{f as ge,i as _e,l as S,t as C}from"./prepareExportBlocks.js";import{q as ve}from"./vendor.js";import{n as ye}from"./remoteImageResolver.js";import{n as be}from"./mermaid.js";var xe={iris:{light:{"--goose-interactive-selected":`#e0e7ff`,"--goose-interactive-selected-fg":`#4f46e5`,"--goose-inline-code-bg":`#eef2ff`,"--goose-inline-code-fg":`#4f46e5`,"--goose-inline-code-border-hover":`#c7d2fe`,"--goose-editor-selection-bg":`#e0e7ff`},dark:{"--goose-interactive-selected":`rgba(99, 102, 241, 0.2)`,"--goose-interactive-selected-fg":`#a5b4fc`,"--goose-inline-code-bg":`#3d3e64`,"--goose-inline-code-fg":`#c7d2fe`,"--goose-inline-code-border-hover":`#6366f1`,"--goose-editor-selection-bg":`rgba(99, 102, 241, 0.35)`}},ocean:{light:{"--goose-interactive-selected":`#dbeafe`,"--goose-interactive-selected-fg":`#2563eb`,"--goose-inline-code-bg":`#eff6ff`,"--goose-inline-code-fg":`#2563eb`,"--goose-inline-code-border-hover":`#bfdbfe`,"--goose-editor-selection-bg":`#dbeafe`},dark:{"--goose-interactive-selected":`rgba(59, 130, 246, 0.2)`,"--goose-interactive-selected-fg":`#93c5fd`,"--goose-inline-code-bg":`#324665`,"--goose-inline-code-fg":`#bfdbfe`,"--goose-inline-code-border-hover":`#3b82f6`,"--goose-editor-selection-bg":`rgba(59, 130, 246, 0.35)`}},mono:{light:{"--goose-interactive-selected":`#e5e5e5`,"--goose-interactive-selected-fg":`#171717`,"--goose-inline-code-bg":`#f5f5f5`,"--goose-inline-code-fg":`#171717`,"--goose-inline-code-border-hover":`#d4d4d4`,"--goose-editor-selection-bg":`#e5e5e5`},dark:{"--goose-interactive-selected":`rgba(255, 255, 255, 0.16)`,"--goose-interactive-selected-fg":`#f5f5f5`,"--goose-inline-code-bg":`#3a3a3a`,"--goose-inline-code-fg":`#f5f5f5`,"--goose-inline-code-border-hover":`#737373`,"--goose-editor-selection-bg":`rgba(255, 255, 255, 0.22)`}},pine:{light:{"--goose-interactive-selected":`#dcfce7`,"--goose-interactive-selected-fg":`#15803d`,"--goose-inline-code-bg":`#f0fdf4`,"--goose-inline-code-fg":`#15803d`,"--goose-inline-code-border-hover":`#bbf7d0`,"--goose-editor-selection-bg":`#dcfce7`},dark:{"--goose-interactive-selected":`rgba(34, 197, 94, 0.2)`,"--goose-interactive-selected-fg":`#86efac`,"--goose-inline-code-bg":`#2b4a37`,"--goose-inline-code-fg":`#bbf7d0`,"--goose-inline-code-border-hover":`#22c55e`,"--goose-editor-selection-bg":`rgba(34, 197, 94, 0.35)`}},amber:{light:{"--goose-interactive-selected":`#fef3c7`,"--goose-interactive-selected-fg":`#b45309`,"--goose-inline-code-bg":`#fffbeb`,"--goose-inline-code-fg":`#b45309`,"--goose-inline-code-border-hover":`#fde68a`,"--goose-editor-selection-bg":`#fef3c7`},dark:{"--goose-interactive-selected":`rgba(245, 158, 11, 0.2)`,"--goose-interactive-selected-fg":`#fbbf24`,"--goose-inline-code-bg":`#4a3b24`,"--goose-inline-code-fg":`#fde68a`,"--goose-inline-code-border-hover":`#f59e0b`,"--goose-editor-selection-bg":`rgba(245, 158, 11, 0.35)`}},coral:{light:{"--goose-interactive-selected":`#ffedd5`,"--goose-interactive-selected-fg":`#c2410c`,"--goose-inline-code-bg":`#fff7ed`,"--goose-inline-code-fg":`#c2410c`,"--goose-inline-code-border-hover":`#fed7aa`,"--goose-editor-selection-bg":`#ffedd5`},dark:{"--goose-interactive-selected":`rgba(249, 115, 22, 0.2)`,"--goose-interactive-selected-fg":`#fdba74`,"--goose-inline-code-bg":`#4f3425`,"--goose-inline-code-fg":`#fed7aa`,"--goose-inline-code-border-hover":`#f97316`,"--goose-editor-selection-bg":`rgba(249, 115, 22, 0.35)`}},rose:{light:{"--goose-interactive-selected":`#ffe4e6`,"--goose-interactive-selected-fg":`#be123c`,"--goose-inline-code-bg":`#fff1f2`,"--goose-inline-code-fg":`#be123c`,"--goose-inline-code-border-hover":`#fecdd3`,"--goose-editor-selection-bg":`#ffe4e6`},dark:{"--goose-interactive-selected":`rgba(244, 63, 94, 0.2)`,"--goose-interactive-selected-fg":`#fda4af`,"--goose-inline-code-bg":`#66333b`,"--goose-inline-code-fg":`#fecdd3`,"--goose-inline-code-border-hover":`#f43f5e`,"--goose-editor-selection-bg":`rgba(244, 63, 94, 0.35)`}},grape:{light:{"--goose-interactive-selected":`#f3e8ff`,"--goose-interactive-selected-fg":`#7e22ce`,"--goose-inline-code-bg":`#faf5ff`,"--goose-inline-code-fg":`#7e22ce`,"--goose-inline-code-border-hover":`#e9d5ff`,"--goose-editor-selection-bg":`#f3e8ff`},dark:{"--goose-interactive-selected":`rgba(168, 85, 247, 0.2)`,"--goose-interactive-selected-fg":`#d8b4fe`,"--goose-inline-code-bg":`#46305d`,"--goose-inline-code-fg":`#e9d5ff`,"--goose-inline-code-border-hover":`#a855f7`,"--goose-editor-selection-bg":`rgba(168, 85, 247, 0.35)`}}};function Se(e){return e.classList.contains(`dark`)}function Ce(e,t){let n=xe[e]??xe.ocean,r=t?n.dark:n.light,i=r[`--goose-interactive-selected`];return{...r,"--goose-interactive-hover":i,"--goose-icon-chip-on-selected":i}}var we=`goose-accent-runtime-vars`;function Te(){if(typeof document>`u`||typeof document.getElementById!=`function`||typeof document.createElement!=`function`)return null;let e=document.getElementById(we);return e||(e=document.createElement(`style`),e.id=we,(document.head||document.documentElement).appendChild(e)),e}function Ee(e,t){if(!e?.style?.setProperty)return;let n=Ce(t,Se(e));for(let[t,r]of Object.entries(n))e.style.setProperty(t,r,`important`);let r=Te();if(!r)return;let i=n[`--goose-inline-code-bg`],a=n[`--goose-inline-code-fg`];r.textContent=`
:root {
  --goose-inline-code-bg: ${i} !important;
  --goose-inline-code-fg: ${a} !important;
  --goose-inline-code-border-hover: ${n[`--goose-inline-code-border-hover`]} !important;
  --goose-interactive-selected: ${n[`--goose-interactive-selected`]} !important;
  --goose-interactive-selected-fg: ${n[`--goose-interactive-selected-fg`]} !important;
  --goose-interactive-hover: ${n[`--goose-interactive-hover`]} !important;
  --goose-icon-chip-on-selected: ${n[`--goose-icon-chip-on-selected`]} !important;
  --goose-editor-selection-bg: ${n[`--goose-editor-selection-bg`]} !important;
}
.workspace-editor-surface .bn-inline-content code,
.quicknote-editor-surface .bn-inline-content code,
.ai-markdown code:not(pre > code),
.ai-md [data-streamdown="inline-code"] {
  background-color: ${i} !important;
  color: ${a} !important;
}
.workspace-editor-surface .bn-inline-content code [data-goose-inline-code-content],
.quicknote-editor-surface .bn-inline-content code [data-goose-inline-code-content] {
  color: ${a} !important;
}
`.trim()}function w(e){if(typeof document>`u`)return;let t=document.documentElement;t.setAttribute(`data-goose-accent`,e),Ee(t,e)}function De(){if(typeof document>`u`)return;let e=document.documentElement;!e||typeof e.getAttribute!=`function`||Ee(e,e.getAttribute(`data-goose-accent`)??`ocean`)}var Oe=[{id:`notion`,name:`Notion 白`,nameEn:`Notion`,description:`极简专业，文档感`,tags:[`极简`,`文档`],mode:`light`,titleFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', monospace`,titleFontSize:28,titleFontWeight:700,titleLineHeight:1.3,titleLetterSpacing:`-0.02em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.8,bodyLetterSpacing:`0`,background:`#ffffff`,cardBg:`#ffffff`,textColor:`#37352f`,secondaryText:`#9ca3af`,accent:`#2d6cdf`,codeBg:`#f5f5f5`,quoteBorder:`#e5e7eb`,calloutBg:`#f9fafb`,tableBorder:`#e5e7eb`,divider:`#e5e7eb`,watermark:`#e0e0e0`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:36,cardRadius:16,cardBorder:`1px solid #f0f0f0`,cardShadow:`0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`obsidian`,name:`Obsidian 夜`,nameEn:`Obsidian`,description:`深色模式，代码感`,tags:[`深色`,`技术`],mode:`dark`,titleFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', monospace`,titleFontSize:26,titleFontWeight:700,titleLineHeight:1.35,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.8,bodyLetterSpacing:`0`,background:`linear-gradient(160deg, #0d1117 0%, #161b22 50%, #0d1117 100%)`,cardBg:`#161b22`,textColor:`#e6edf3`,secondaryText:`#8b949e`,accent:`#58a6ff`,codeBg:`#0d1117`,quoteBorder:`#30363d`,calloutBg:`#21262d`,tableBorder:`#30363d`,divider:`#30363d`,watermark:`#6e7681`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:36,cardRadius:16,cardBorder:`1px solid #30363d`,cardShadow:`0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)`,showDecorations:!0,decorationColor:`rgba(88,166,255,0.06)`,watermarkVisible:!0},{id:`github-light`,name:`GitHub 浅`,nameEn:`GitHub Light`,description:`GitHub 官方浅色，开发者友好`,tags:[`浅色`,`开发`],mode:`light`,titleFont:`'Inter', -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', 'Monaco', monospace`,titleFontSize:26,titleFontWeight:600,titleLineHeight:1.3,titleLetterSpacing:`-0.005em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.7,bodyLetterSpacing:`0`,background:`#ffffff`,cardBg:`#ffffff`,textColor:`#1f2328`,secondaryText:`#59636e`,accent:`#0969da`,codeBg:`#f6f8fa`,quoteBorder:`#d1d9e0`,calloutBg:`#f6f8fa`,tableBorder:`#d1d9e0`,divider:`#d1d9e0`,watermark:`#8b949e`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:36,cardRadius:12,cardBorder:`1px solid #d1d9e0`,cardShadow:`none`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`github-dark`,name:`GitHub 深`,nameEn:`GitHub Dark`,description:`GitHub 官方深色，平静专注`,tags:[`深色`,`开发`],mode:`dark`,titleFont:`'Inter', -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', 'Monaco', monospace`,titleFontSize:26,titleFontWeight:600,titleLineHeight:1.3,titleLetterSpacing:`-0.005em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.7,bodyLetterSpacing:`0`,background:`#0d1117`,cardBg:`#0d1117`,textColor:`#e6edf3`,secondaryText:`#8b949e`,accent:`#2f81f7`,codeBg:`#161b22`,quoteBorder:`#30363d`,calloutBg:`#161b22`,tableBorder:`#30363d`,divider:`#21262d`,watermark:`#6e7681`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:36,cardRadius:12,cardBorder:`1px solid #30363d`,cardShadow:`none`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`vercel-dark`,name:`Vercel 极黑`,nameEn:`Vercel Geist`,description:`纯黑极简，硬核现代`,tags:[`深色`,`极简`],mode:`dark`,titleFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', monospace`,titleFontSize:34,titleFontWeight:600,titleLineHeight:1.15,titleLetterSpacing:`-0.03em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.7,bodyLetterSpacing:`-0.005em`,background:`#0a0a0a`,cardBg:`#0a0a0a`,textColor:`#ededed`,secondaryText:`#a1a1aa`,accent:`#ffffff`,codeBg:`#171717`,quoteBorder:`#262626`,calloutBg:`#141414`,tableBorder:`#262626`,divider:`#1f1f1f`,watermark:`#8b8b93`,containerPaddingX:64,containerPaddingY:64,cardPaddingX:44,cardPaddingY:44,cardRadius:0,cardBorder:`1px solid #262626`,cardShadow:`none`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`tokyo-night`,name:`东京之夜`,nameEn:`Tokyo Night`,description:`深蓝紫调，编辑器经典`,tags:[`深色`,`代码`],mode:`dark`,titleFont:`'Inter', 'JetBrains Mono', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', 'SF Mono', monospace`,titleFontSize:28,titleFontWeight:600,titleLineHeight:1.3,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`linear-gradient(155deg, #1a1b26 0%, #1f2335 100%)`,cardBg:`#24283b`,textColor:`#c0caf5`,secondaryText:`#9aa5ce`,accent:`#7aa2f7`,codeBg:`#1f2335`,quoteBorder:`#414868`,calloutBg:`#292e42`,tableBorder:`#414868`,divider:`#292e42`,watermark:`#7a83b0`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:42,cardPaddingY:38,cardRadius:14,cardBorder:`1px solid #292e42`,cardShadow:`0 12px 36px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.02)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`catppuccin`,name:`Catppuccin`,nameEn:`Macchiato`,description:`柔和粉调暗色，开发者最爱`,tags:[`深色`,`柔和`],mode:`dark`,titleFont:`'Inter', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:28,titleFontWeight:600,titleLineHeight:1.3,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`#24273a`,cardBg:`#1e2030`,textColor:`#cad3f5`,secondaryText:`#a5adcb`,accent:`#c6a0f6`,codeBg:`#181926`,quoteBorder:`#494d64`,calloutBg:`#363a4f`,tableBorder:`#494d64`,divider:`#363a4f`,watermark:`#6e738d`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:38,cardRadius:14,cardBorder:`1px solid #363a4f`,cardShadow:`0 10px 30px rgba(0,0,0,0.35)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`linear`,name:`Linear`,nameEn:`Linear`,description:`几何冷感，工程师审美`,tags:[`浅色`,`几何`],mode:`light`,titleFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', -apple-system, sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:30,titleFontWeight:600,titleLineHeight:1.2,titleLetterSpacing:`-0.025em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.7,bodyLetterSpacing:`-0.005em`,background:`linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)`,cardBg:`#ffffff`,textColor:`#1c1d22`,secondaryText:`#6e7079`,accent:`#5e6ad2`,codeBg:`#f7f8fa`,quoteBorder:`#ebebee`,calloutBg:`#f7f8fa`,tableBorder:`#ebebee`,divider:`#ebebee`,watermark:`#b8b8c0`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:42,cardPaddingY:40,cardRadius:14,cardBorder:`1px solid #ebebee`,cardShadow:`0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.04)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0}],ke=[{id:`medium`,name:`Medium 杂志`,nameEn:`Medium`,description:`衬线大标题，阅读感`,tags:[`杂志`,`阅读`],mode:`light`,titleFont:`'Noto Serif SC', 'Georgia', 'Times New Roman', serif`,bodyFont:`'Noto Serif SC', 'Georgia', 'Times New Roman', serif`,codeFont:`'JetBrains Mono', 'SF Mono', monospace`,titleFontSize:34,titleFontWeight:400,titleLineHeight:1.2,titleLetterSpacing:`-0.01em`,titleAlign:`center`,bodyFontSize:16,bodyLineHeight:1.9,bodyLetterSpacing:`0.01em`,background:`#faf9f6`,cardBg:`#ffffff`,textColor:`#292929`,secondaryText:`#757575`,accent:`#1a8917`,codeBg:`#f7f7f7`,quoteBorder:`#e5e5e5`,calloutBg:`#f9f9f9`,tableBorder:`#e5e5e5`,divider:`#e5e5e5`,watermark:`#d4d4d4`,containerPaddingX:64,containerPaddingY:64,cardPaddingX:48,cardPaddingY:48,cardRadius:4,cardBorder:`none`,cardShadow:`0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`kenya-hara`,name:`原研哉·白`,nameEn:`Kenya Hara`,description:`极致留白，东方禅意`,tags:[`极简`,`设计`],mode:`light`,titleFont:`'Noto Sans SC', 'Helvetica Neue', sans-serif`,bodyFont:`'Noto Sans SC', 'Helvetica Neue', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:20,titleFontWeight:300,titleLineHeight:1.6,titleLetterSpacing:`0.15em`,titleAlign:`left`,bodyFontSize:14,bodyLineHeight:2.2,bodyLetterSpacing:`0.05em`,background:`#fefefe`,cardBg:`transparent`,textColor:`#333333`,secondaryText:`#999999`,accent:`#888888`,codeBg:`#f8f8f8`,quoteBorder:`#dddddd`,calloutBg:`#fafafa`,tableBorder:`#eeeeee`,divider:`#eeeeee`,watermark:`#cccccc`,containerPaddingX:80,containerPaddingY:80,cardPaddingX:0,cardPaddingY:0,cardRadius:0,cardBorder:`none`,cardShadow:`none`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!1},{id:`typewriter`,name:`复古打字机`,nameEn:`Typewriter`,description:`米黄纸张，文学气息`,tags:[`复古`,`文学`],mode:`light`,titleFont:`'Courier Prime', 'Noto Serif SC', 'Songti SC', serif`,bodyFont:`'Courier Prime', 'Noto Serif SC', 'Songti SC', serif`,codeFont:`'Courier Prime', monospace`,titleFontSize:24,titleFontWeight:700,titleLineHeight:1.4,titleLetterSpacing:`0.02em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.85,bodyLetterSpacing:`0.01em`,background:`#f5f0e6`,cardBg:`#faf6ed`,textColor:`#3d3225`,secondaryText:`#8a7e6b`,accent:`#8b4513`,codeBg:`#f0ebe0`,quoteBorder:`#d4c9b8`,calloutBg:`#f5f0e4`,tableBorder:`#d4c9b8`,divider:`#d4c9b8`,watermark:`#d8cfc4`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:40,cardRadius:2,cardBorder:`1px solid #e8e0d0`,cardShadow:`0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 0 60px rgba(139,69,19,0.02)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`academic`,name:`学术 LaTeX`,nameEn:`Academic`,description:`严谨排版，论文感`,tags:[`学术`,`严肃`],mode:`light`,titleFont:`'Noto Serif SC', 'Times New Roman', 'Georgia', serif`,bodyFont:`'Noto Serif SC', 'Times New Roman', 'Georgia', serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:22,titleFontWeight:700,titleLineHeight:1.4,titleLetterSpacing:`0`,titleAlign:`center`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`#ffffff`,cardBg:`#ffffff`,textColor:`#000000`,secondaryText:`#555555`,accent:`#0066cc`,codeBg:`#f8f8f8`,quoteBorder:`#cccccc`,calloutBg:`#fafafa`,tableBorder:`#cccccc`,divider:`#cccccc`,watermark:`#bbbbbb`,containerPaddingX:64,containerPaddingY:64,cardPaddingX:48,cardPaddingY:40,cardRadius:0,cardBorder:`1px solid #e0e0e0`,cardShadow:`none`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`stationery`,name:`手账便签`,nameEn:`Stationery`,description:`温暖手写，生活气息`,tags:[`手写`,`温馨`],mode:`light`,titleFont:`'ZCOOL XiaoWei', 'Ma Shan Zheng', 'Noto Sans SC', cursive`,bodyFont:`'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:26,titleFontWeight:400,titleLineHeight:1.4,titleLetterSpacing:`0.04em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.85,bodyLetterSpacing:`0.02em`,background:`#fef9e7`,cardBg:`#fffef5`,textColor:`#4a4035`,secondaryText:`#9a8e7e`,accent:`#d97706`,codeBg:`#faf5e6`,quoteBorder:`#e8dcc8`,calloutBg:`#fdf8ed`,tableBorder:`#e8dcc8`,divider:`#e8dcc8`,watermark:`#ddd5c8`,containerPaddingX:52,containerPaddingY:52,cardPaddingX:36,cardPaddingY:36,cardRadius:12,cardBorder:`1px solid #f0e8d0`,cardShadow:`0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`mocha-mousse`,name:`摩卡慕斯`,nameEn:`Mocha Mousse`,description:`暖棕大地色，2025 年度风`,tags:[`浅色`,`温暖`],mode:`light`,titleFont:`'Fraunces', 'Noto Serif SC', Georgia, serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:30,titleFontWeight:500,titleLineHeight:1.25,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.8,bodyLetterSpacing:`0.005em`,background:`#f5ede0`,cardBg:`#fdf8ee`,textColor:`#3d2f24`,secondaryText:`#8a7560`,accent:`#a47864`,codeBg:`#ede3d3`,quoteBorder:`#c9b8a3`,calloutBg:`#f5ede0`,tableBorder:`#d8c8b3`,divider:`#e5d8c4`,watermark:`#b8a690`,containerPaddingX:60,containerPaddingY:60,cardPaddingX:44,cardPaddingY:42,cardRadius:18,cardBorder:`none`,cardShadow:`0 4px 24px rgba(164,120,100,0.1), 0 1px 2px rgba(164,120,100,0.06)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`brutalist`,name:`野性印刷`,nameEn:`Brutalist`,description:`硬边大字 + 实心投影，叛逆派`,tags:[`浅色`,`特立独行`],mode:`light`,titleFont:`'Space Grotesk', 'Inter', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:42,titleFontWeight:700,titleLineHeight:1.02,titleLetterSpacing:`-0.04em`,titleAlign:`left`,bodyFontSize:16,bodyLineHeight:1.6,bodyLetterSpacing:`0`,background:`#f5f5f5`,cardBg:`#ffffff`,textColor:`#0a0a0a`,secondaryText:`#525252`,accent:`#ff5500`,codeBg:`#0a0a0a`,codeTextColor:`#fafafa`,quoteBorder:`#0a0a0a`,calloutBg:`#ffe4d6`,tableBorder:`#0a0a0a`,divider:`#0a0a0a`,watermark:`#a3a3a3`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:38,cardRadius:0,cardBorder:`2px solid #0a0a0a`,cardShadow:`6px 6px 0 #0a0a0a`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0},{id:`risograph`,name:`Risograph`,nameEn:`Risograph`,description:`孔版印刷，荧光油墨手感`,tags:[`浅色`,`印刷`],mode:`light`,titleFont:`'Fraunces', 'Noto Serif SC', Georgia, serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:28,titleFontWeight:600,titleLineHeight:1.25,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.8,bodyLetterSpacing:`0.005em`,background:`#faf5ec`,cardBg:`#fffaf0`,textColor:`#2c2825`,secondaryText:`#8a7d6e`,accent:`#f06f6f`,codeBg:`#f5ede0`,quoteBorder:`#d4c5a8`,calloutBg:`#fdf2e0`,tableBorder:`#d4c5a8`,divider:`#e5d8c4`,watermark:`#b8a690`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:42,cardPaddingY:40,cardRadius:4,cardBorder:`1px solid #d4c5a8`,cardShadow:`4px 4px 0 rgba(240,111,111,0.18)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0}],Ae=[{id:`neon`,name:`霓虹渐变`,nameEn:`Neon`,description:`鲜艳渐变，视觉冲击`,tags:[`渐变`,`社交`],mode:`light`,titleFont:`'Inter', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:36,titleFontWeight:800,titleLineHeight:1.15,titleLetterSpacing:`-0.02em`,titleAlign:`center`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 70%, #f5576c 100%)`,cardBg:`rgba(255,255,255,0.97)`,textColor:`#1a1a2e`,secondaryText:`#6b7280`,accent:`#7c3aed`,codeBg:`#f5f3ff`,quoteBorder:`#ddd6fe`,calloutBg:`#faf5ff`,tableBorder:`#e9d5ff`,divider:`#e9d5ff`,watermark:`#c4b5fd`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:44,cardPaddingY:40,cardRadius:24,cardBorder:`1px solid rgba(255,255,255,0.5)`,cardShadow:`0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.3)`,showDecorations:!0,decorationColor:`rgba(124,58,237,0.08)`,watermarkVisible:!0},{id:`poster`,name:`海报大字报`,nameEn:`Poster`,description:`冲击力强，短内容`,tags:[`海报`,`冲击`],mode:`dark`,titleFont:`'Inter', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:42,titleFontWeight:900,titleLineHeight:1.1,titleLetterSpacing:`-0.03em`,titleAlign:`center`,bodyFontSize:16,bodyLineHeight:1.7,bodyLetterSpacing:`0`,background:`linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)`,cardBg:`transparent`,textColor:`#ffffff`,secondaryText:`rgba(255,255,255,0.7)`,accent:`#00d9ff`,codeBg:`rgba(255,255,255,0.08)`,quoteBorder:`rgba(255,255,255,0.2)`,calloutBg:`rgba(255,255,255,0.05)`,tableBorder:`rgba(255,255,255,0.15)`,divider:`rgba(255,255,255,0.15)`,watermark:`rgba(255,255,255,0.45)`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:40,cardRadius:0,cardBorder:`none`,cardShadow:`none`,showDecorations:!0,decorationColor:`rgba(0,217,255,0.1)`,watermarkVisible:!0},{id:`synthwave`,name:`蒸汽合成`,nameEn:`Synthwave`,description:`复古赛博朋克，霓虹回潮`,tags:[`深色`,`复古`],mode:`dark`,titleFont:`'Space Grotesk', 'Inter', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', monospace`,titleFontSize:32,titleFontWeight:700,titleLineHeight:1.15,titleLetterSpacing:`-0.02em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`linear-gradient(165deg, #1a0533 0%, #2d0a4e 45%, #0d0220 100%)`,cardBg:`rgba(20,8,40,0.6)`,textColor:`#f8f8f2`,secondaryText:`#bfa3d9`,accent:`#ff2a6d`,codeBg:`rgba(0,0,0,0.4)`,quoteBorder:`#ff2a6d`,calloutBg:`rgba(255,42,109,0.08)`,tableBorder:`rgba(255,255,255,0.12)`,divider:`rgba(255,255,255,0.08)`,watermark:`rgba(255,120,220,0.55)`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:42,cardPaddingY:40,cardRadius:18,cardBorder:`1px solid rgba(255,42,109,0.25)`,cardShadow:`0 0 50px rgba(255,42,109,0.18), inset 0 0 0 1px rgba(255,255,255,0.04)`,showDecorations:!0,decorationColor:`rgba(0,217,255,0.12)`,watermarkVisible:!0},{id:`solarized-light`,name:`Solarized 浅`,nameEn:`Solarized`,description:`经典护眼配色，米黄沉静`,tags:[`浅色`,`经典`],mode:`light`,titleFont:`'Inter', 'IBM Plex Sans', 'Noto Sans SC', sans-serif`,bodyFont:`'Inter', 'Noto Sans SC', sans-serif`,codeFont:`'JetBrains Mono', 'IBM Plex Mono', monospace`,titleFontSize:27,titleFontWeight:600,titleLineHeight:1.3,titleLetterSpacing:`-0.01em`,titleAlign:`left`,bodyFontSize:15,bodyLineHeight:1.75,bodyLetterSpacing:`0`,background:`#fdf6e3`,cardBg:`#fdf6e3`,textColor:`#586e75`,secondaryText:`#93a1a1`,accent:`#268bd2`,codeBg:`#eee8d5`,quoteBorder:`#93a1a1`,calloutBg:`#eee8d5`,tableBorder:`#d8d2bf`,divider:`#eee8d5`,watermark:`#a8a08a`,containerPaddingX:56,containerPaddingY:56,cardPaddingX:40,cardPaddingY:38,cardRadius:8,cardBorder:`1px solid #eee8d5`,cardShadow:`0 1px 3px rgba(88,110,117,0.06), 0 4px 16px rgba(88,110,117,0.04)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0}],T={default:`ui-sans-serif`,serif:`仓耳今楷`,mono:`DM Mono`},je={primary:`https://cdn.jsdelivr.net/npm/harmonyos-sans-webfont-splitted@1.2.1/dist/HarmonyOS_Sans_SC/Regular/Regular.css`,fallback:`https://unpkg.com/harmonyos-sans-webfont-splitted@1.2.1/dist/HarmonyOS_Sans_SC/Regular/Regular.css`},Me=[`仓耳今楷`,`仓耳今楷03W04`,`仓耳今楷03简繁 W04`,`TsangerJinKai03-W04`],Ne=[`Songti SC`,`STSong`,`SimSun`,`Cambria`],Pe=[`https://cdn.jsdmirror.com/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2`,`https://cdn.jsdelivr.net/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2`,`https://raw.githubusercontent.com/eachann1024/Resources/d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2`],Fe={"HarmonyOS Sans SC":je,仓耳今楷:Pe},Ie=[`-apple-system`,`BlinkMacSystemFont`,`Segoe UI`,`Helvetica Neue`,`Arial`,`HarmonyOS Sans SC`,`PingFang SC`,`Hiragino Sans GB`,`Microsoft YaHei`,`Noto Sans SC`],Le=[`ui-monospace`,`Menlo`,`Consolas`,`HarmonyOS Sans SC`,`PingFang SC`,`Hiragino Sans GB`,`Microsoft YaHei`,`Noto Sans SC`],E=new Map,Re=!1,D=e=>e.trim().replace(/^["']+|["']+$/g,``),O=e=>e?e.split(`,`).map(D).filter(Boolean):[],ze=new Set([`serif`,`sans-serif`,`monospace`,`cursive`,`fantasy`,`system-ui`,`ui-serif`,`ui-sans-serif`,`ui-monospace`,`ui-rounded`,`emoji`,`math`,`fangsong`,`inherit`,`initial`,`unset`]),Be=e=>{let t=D(e);return t?ze.has(t)?t:`"${t}"`:null},Ve=e=>Be(e)??e,He=e=>Array.from(new Set(e.map(Be).filter(e=>!!e))),k=(e,t,n,r,i)=>We(He([...e.length?e:[t],...n,...r,i])),Ue=()=>{let e=typeof navigator<`u`&&navigator.platform||``,t=/Mac|iPod|iPhone|iPad/.test(e),n=/Win/.test(e);return t?{serif:[`Georgia`,`Times`]}:n?{serif:[`"Times New Roman"`,`Georgia`,`Times`]}:{serif:[`Georgia`,`Times`]}},We=e=>e.filter(Boolean).join(`, `),Ge=(e,t)=>{let n=document.createElement(`link`);n.rel=`stylesheet`,n.href=e,n.crossOrigin=`anonymous`,t&&(n.onerror=t),document.head.appendChild(n)},Ke=()=>{if(Re||typeof document>`u`)return;Re=!0;let{primary:e,fallback:t}=Fe[`HarmonyOS Sans SC`];Ge(e,()=>{console.warn(`[fontLoader] HarmonyOS Sans SC 主 CDN 失败，改用 unpkg`),Ge(t,()=>{console.warn(`[fontLoader] HarmonyOS Sans SC 远程字体均失败，回退系统中文字体`)})})};function qe(){typeof document>`u`||(Ke(),Xe(T.serif))}var A=e=>typeof document.fonts.check==`function`&&document.fonts.check(`1em "${e}"`),Je=async e=>{if(A(e))return!0;for(let t of Me)try{let n=new FontFace(e,`local("${t}")`,{style:`normal`,weight:`400`});return await n.load(),document.fonts.add(n),!0}catch{}return A(e)},Ye=async e=>{if(await Je(e)||(await et([e]),A(e)))return!0;for(let t of Pe)try{let n=new FontFace(e,`url("${t}")`,{style:`normal`,weight:`400`});return await n.load(),document.fonts.add(n),!0}catch(n){console.warn(`[fontLoader] ${e} 从 ${t} 加载失败`,n)}return!1};function Xe(e){if(typeof document>`u`||typeof FontFace>`u`||!(`fonts`in document))return Promise.resolve(!1);let t=E.get(e);if(t)return t;let n=Ye(e).catch(t=>(console.warn(`[fontLoader] ${e} 远端加载失败`,t),E.delete(e),!1));return E.set(e,n),n}async function Ze(e,t){if(e!==`serif`)return;let n=O(t.serif.font);if(n.length===0||n.includes(T.serif)){Xe(T.serif);return}et(n)}function Qe(e){if(typeof document>`u`)return;Ke();let t=Ue(),n=document.documentElement,r=O(e.default.font),i=O(e.serif.font),a=O(e.mono.font);n.style.setProperty(`--font-default`,k(r,T.default,Ie,[],`sans-serif`)),n.style.setProperty(`--font-serif`,k(i,T.serif,[`仓耳今楷`,...Ne],t.serif,`serif`)),n.style.setProperty(`--font-mono`,k(a,T.mono,Le,[],`monospace`))}function $e(e,t){let n=e??`default`,r={default:t.default.font||T.default,serif:t.serif.font||T.serif,mono:t.mono.font||T.mono},i={default:Ie,serif:[`仓耳今楷`,...Ne],mono:Le},a=[...O(r[n]),...i[n]];return Array.from(new Set(a))}async function et(e){if(typeof document>`u`||!(`fonts`in document))return;let t=Array.from(new Set(e)).map(D).filter(Boolean);t.length&&await Promise.allSettled(t.map(e=>document.fonts.load(`1em "${e}"`)))}var tt={default:{label:null,font:null},serif:{label:null,font:null},mono:{label:null,font:null}},nt=`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`,rt=`ui-monospace, "DM Mono", Menlo, Consolas, "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", monospace`;function j(e,t){if(typeof document>`u`)return t;try{return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}catch{return t}}function M(e,t){let n=e.trim();return n?n.startsWith(`#`)||n.startsWith(`rgb`)||n.startsWith(`hsl`)||n.startsWith(`oklch`)||n.startsWith(`var(`)?n:`hsl(${n})`:t}function it(e){return e.map(e=>Ve(e)).join(`, `)}var N={id:`notebook`,name:`笔记本`,nameEn:`Notebook`,description:`所见即所得`,tags:[`当前`,`编辑器`],mode:`light`,titleFont:nt,bodyFont:nt,codeFont:rt,titleFontSize:26,titleFontWeight:700,titleLineHeight:1.3,titleLetterSpacing:`-0.02em`,titleAlign:`left`,bodyFontSize:16,bodyLineHeight:1.7,bodyLetterSpacing:`0`,background:`#ffffff`,cardBg:`#ffffff`,textColor:`#1f1f1f`,secondaryText:`#6e6e6e`,accent:`#2563eb`,codeBg:`#f3f2f1`,quoteBorder:`#e8e7e5`,calloutBg:`#f7f6f3`,tableBorder:`#e8e7e5`,divider:`#e9e9e7`,watermark:`#d4d4d4`,containerPaddingX:28,containerPaddingY:28,cardPaddingX:40,cardPaddingY:36,cardRadius:12,cardBorder:`1px solid #e9e9e7`,cardShadow:`0 1px 2px rgba(15,23,42,0.04)`,showDecorations:!1,decorationColor:`transparent`,watermarkVisible:!0};function at(e={}){let t=e.resolvedTheme===`dark`,n=e.editorFontSize??16,r=e.customFonts??tt,i=e.fontFamily??`default`,a=it($e(i,r)),o=j(i===`serif`?`--font-serif`:i===`mono`?`--font-mono`:`--font-default`,a)||a,s=j(`--font-mono`,``)||it($e(`mono`,r)),c=j(`--goose-interactive-selected-fg`,t?`#93c5fd`:`#2563eb`),l=j(`--goose-callout-bg`,t?`#2f2f2f`:`#f7f6f3`),u=j(`--goose-callout-border`,t?`#3d3d3d`:`#e9e9e7`),d=j(`--goose-block-subtle-bg`,t?`#252525`:`#f3f2f1`),f=j(`--goose-block-subtle-border`,t?`#363636`:`#e8e7e5`),p=M(j(`--foreground`,t?`0 0% 90%`:`0 0% 12%`),t?`#e6e6e6`:`#1f1f1f`),m=M(j(`--muted-foreground`,t?`0 0% 66%`:`0 0% 43%`),t?`#a8a8a8`:`#6e6e6e`),h=t?M(j(`--goose-editor-bg`,`60 2.2% 18%`),`#2f2f2e`):`#ffffff`;return{...N,mode:t?`dark`:`light`,titleFont:o,bodyFont:o,codeFont:s,titleFontSize:Math.round(n*1.625),bodyFontSize:n,background:h,cardBg:h,textColor:p,secondaryText:m,accent:c,codeBg:d,quoteBorder:f,calloutBg:l,tableBorder:f,divider:u,watermark:t?`#6e6e6e`:`#d4d4d4`,cardBorder:`1px solid ${u}`,cardShadow:t?`none`:N.cardShadow}}var ot=e=>{if(e===`notebook`)return N;let t=[...Oe,...ke,...Ae].find(t=>t.id===e);if(!t)throw Error(`Theme ${e} not found in presets!`);return t},st=[`notebook`,`github-light`,`medium`,`kenya-hara`,`typewriter`,`neon`,`stationery`,`poster`,`github-dark`,`vercel-dark`,`tokyo-night`,`catppuccin`,`synthwave`,`mocha-mousse`,`brutalist`,`risograph`],P=st.map(e=>ot(e)),ct={notion:`github-light`,obsidian:`github-dark`,academic:`medium`,linear:`github-light`,"solarized-light":`typewriter`};function lt(e){if(typeof e==`string`){let t=st.find(t=>t===e);if(t)return t;let n=ct[e];if(n)return n}return`notebook`}function ut(e){return P.find(t=>t.id===e)??P[0]}function dt(e,t){let n=lt(e);return n===`notebook`?at(t):ut(n)}var ft={ai:{enabled:!1,readGlobalPrompt:!0,readLocalSkills:!0,runtime:`pi`,selectedModelId:null,workspaceSelectedModelId:null,workspaceReasoningLevel:`default`,customProviderId:`deepseek`,customProtocol:`openai-responses`,customOpenAIResponsesBaseURL:p,customOpenAIBaseURL:p,customClaudeBaseURL:d,customOpenAIResponsesApiKey:``,customOpenAIApiKey:``,customClaudeApiKey:``,customModelOptions:[],tinyfishApiKey:``}};function pt(e){return{...ft,setAIEnabled:t=>e(e=>({ai:{...e.ai,enabled:t}})),setAIReadGlobalPrompt:t=>e(e=>({ai:{...e.ai,readGlobalPrompt:t}})),setAIReadLocalSkills:t=>e(e=>({ai:{...e.ai,readLocalSkills:t}})),setAISelectedModelId:t=>e(e=>({ai:{...e.ai,selectedModelId:t}})),setAIWorkspaceSelectedModelId:t=>e(e=>({ai:{...e.ai,workspaceSelectedModelId:t}})),setAIWorkspaceReasoningLevel:t=>e(e=>({ai:{...e.ai,workspaceReasoningLevel:t}})),saveAICustomConfig:({providerId:t,protocol:n,baseURL:r,apiKey:i,modelOptions:a})=>e(e=>{let s=u(t)?t:`deepseek`,c=ee(s),f=o(a),h=e.ai.selectedModelId&&f.some(t=>t.id===e.ai.selectedModelId)?e.ai.selectedModelId:f[0]?.id??e.ai.selectedModelId,g=(e.ai.workspaceSelectedModelId&&f.some(t=>t.id===e.ai.workspaceSelectedModelId),e.ai.workspaceSelectedModelId),ne=n??le(s,h,c.protocol),_=m(l(s)??r,ne===`claude`?d:p),v=pe(i),y=te(s);return{ai:{...e.ai,customProviderId:s,customProtocol:ne,customOpenAIResponsesBaseURL:y.includes(`openai-responses`)?_:e.ai.customOpenAIResponsesBaseURL,customOpenAIBaseURL:y.includes(`openai`)?_:e.ai.customOpenAIBaseURL,customClaudeBaseURL:y.includes(`claude`)?_:e.ai.customClaudeBaseURL,customOpenAIResponsesApiKey:y.includes(`openai-responses`)?v:e.ai.customOpenAIResponsesApiKey,customOpenAIApiKey:y.includes(`openai`)?v:e.ai.customOpenAIApiKey,customClaudeApiKey:y.includes(`claude`)?v:e.ai.customClaudeApiKey,customModelOptions:f,selectedModelId:h,workspaceSelectedModelId:g}}}),setTinyfishApiKey:t=>e(e=>({ai:{...e.ai,tinyfishApiKey:pe(t)}}))}}var F={showWatermark:!0,showBrand:!0,showDate:!0,showTime:!0,showTitle:!0};function I(e){return{...F,...e??{}}}function mt(e,t=F){if(!e.watermarkVisible||!t.showWatermark)return``;let n=[];t.showBrand&&n.push(`鹅的笔记`);let r=n.length>0?`<span class="gooseshot-watermark-brand">${n.join(` · `)}</span>`:``,i=``;if(t.showDate){let e=new Date,n=e=>String(e).padStart(2,`0`);i=`<div class="gooseshot-watermark-date">${`${e.getFullYear()}年${n(e.getMonth()+1)}月${n(e.getDate())}日`}${t.showTime?` ${n(e.getHours())}:${n(e.getMinutes())}:${n(e.getSeconds())}`:``}</div>`}return`<div class="gooseshot-watermark">
    <div class="gooseshot-watermark-left">${r}</div>
    ${i}
  </div>`}var ht={theme:`system`,accentColor:ue,codeStyle:`github`,defaultCodeBlockWrap:!1,customFonts:{default:{label:null,font:null},serif:{label:null,font:null},mono:{label:null,font:null}},uiFontSize:ae,editorFontSize:16,aiChatScale:1,imageExportWatermark:F,imageExportThemeId:`notebook`,hideExpandArrows:!1,randomIconOnCreate:!0,singleTabMode:!0};function gt(e,t){return{...ht,setTheme:n=>{e({theme:n}),t().applyTheme(n)},setAccentColor:n=>{e({accentColor:n}),t().applyAccentColor(n)},toggleDarkMode:()=>{e(e=>{let n=e.theme===`system`?`light`:e.theme===`light`?`dark`:`system`;return t().applyTheme(n),{theme:n}})},setCodeStyle:n=>{e({codeStyle:n}),t().applyCodeStyle(n)},setDefaultCodeBlockWrap:t=>e({defaultCodeBlockWrap:t}),setCustomLabel:(t,n)=>e(e=>({customFonts:{...e.customFonts,[t]:{...e.customFonts[t],label:n}}})),setCustomFont:(t,n)=>e(e=>({customFonts:{...e.customFonts,[t]:{...e.customFonts[t],font:n}}})),resetCustomFont:t=>e(e=>({customFonts:{...e.customFonts,[t]:{label:null,font:null}}})),setUIFontSize:t=>e({uiFontSize:t}),setEditorFontSize:t=>e({editorFontSize:Math.max(12,Math.min(24,t))}),increaseEditorFontSize:()=>e(e=>({editorFontSize:Math.min(24,e.editorFontSize+1)})),decreaseEditorFontSize:()=>e(e=>({editorFontSize:Math.max(12,e.editorFontSize-1)})),resetEditorFontSize:()=>e({editorFontSize:16}),setAiChatScale:t=>e({aiChatScale:Math.max(.7,Math.min(1.5,t))}),increaseAiChatScale:()=>e(e=>({aiChatScale:Math.min(1.5,Math.round((e.aiChatScale+.1)*10)/10)})),decreaseAiChatScale:()=>e(e=>({aiChatScale:Math.max(.7,Math.round((e.aiChatScale-.1)*10)/10)})),setImageExportWatermark:t=>e({imageExportWatermark:I(t)}),setImageExportThemeId:t=>e({imageExportThemeId:t}),setHideExpandArrows:t=>e({hideExpandArrows:t}),setRandomIconOnCreate:t=>e({randomIconOnCreate:t}),setSingleTabMode:t=>e({singleTabMode:t})}}var _t={utools:{globalSearchEnabled:!1,openSearchInUtools:!0,useInternalImageViewer:!1,windowHeight:800}};function vt(e){return{..._t,setUToolsGlobalSearchEnabled:t=>e(e=>({utools:{...e.utools,globalSearchEnabled:t}})),setOpenSearchInUtools:t=>e(e=>({utools:{...e.utools,openSearchInUtools:t}})),setUseInternalImageViewer:t=>e(e=>({utools:{...e.utools,useInternalImageViewer:t}})),setUToolsWindowHeight:t=>e(e=>({utools:{...e.utools,windowHeight:Math.min(g,Math.max(600,t))}}))}}var yt=[`openSettings`,`editorFindOpen`,`newNote`,`reopenTab`],bt=[`saveNote`],xt=new Set([...yt,...bt]);function St(e=v()){return{openSettings:`Mod+,`,editorFindOpen:`Mod+F`,newNote:`Mod+N`,reopenTab:`Mod+Shift+T`}}var L={toggleSidebar:`Alt+B`,toggleAIPanel:`Mod+J`,openSearch:`Mod+Shift+K`,toggleTheme:`Mod+Shift+L`,navBack:`Mod+[`,navForward:`Mod+]`,newTab:`Mod+T`},Ct={desktop:{wakeHotkey:ie,wakeHotkeyEnabled:!0,searchHotkey:ce,searchHotkeyEnabled:!0,quicknoteHotkey:re,quicknoteHotkeyEnabled:!0,wakeHotkeyStatus:y,searchHotkeyStatus:y,quicknoteHotkeyStatus:y},closeTabShortcut:``,searchPanelCloseShortcut:``,appShortcuts:{...L}};function wt(e){return{...Ct,setWakeHotkey:t=>e(e=>({desktop:{...e.desktop,wakeHotkey:t,wakeHotkeyStatus:y}})),setWakeHotkeyEnabled:t=>e(e=>({desktop:{...e.desktop,wakeHotkeyEnabled:t,wakeHotkeyStatus:t?y:{state:`disabled`,message:`已关闭全局唤醒快捷键`}}})),setSearchHotkey:t=>e(e=>({desktop:{...e.desktop,searchHotkey:t,searchHotkeyStatus:y}})),setSearchHotkeyEnabled:t=>e(e=>({desktop:{...e.desktop,searchHotkeyEnabled:t,searchHotkeyStatus:t?y:{state:`disabled`,message:`已关闭全局搜索快捷键`}}})),setQuicknoteHotkey:t=>e(e=>({desktop:{...e.desktop,quicknoteHotkey:t,quicknoteHotkeyStatus:y}})),setQuicknoteHotkeyEnabled:t=>e(e=>({desktop:{...e.desktop,quicknoteHotkeyEnabled:t,quicknoteHotkeyStatus:t?y:{state:`disabled`,message:`已关闭速记小窗全局快捷键`}}})),setWakeHotkeyStatus:t=>e(e=>({desktop:{...e.desktop,wakeHotkeyStatus:b(t)}})),setSearchHotkeyStatus:t=>e(e=>({desktop:{...e.desktop,searchHotkeyStatus:b(t)}})),setQuicknoteHotkeyStatus:t=>e(e=>({desktop:{...e.desktop,quicknoteHotkeyStatus:b(t)}})),setCloseTabShortcut:t=>e({closeTabShortcut:t}),setSearchPanelCloseShortcut:t=>e({searchPanelCloseShortcut:t}),setAppShortcut:(t,n)=>{xt.has(t)||e(e=>({appShortcuts:{...e.appShortcuts,[t]:n}}))},resetAppShortcuts:()=>e({appShortcuts:{...L}})}}var Tt={searchProviders:se,searchAllNotebooks:!1,showRecentInSearch:!0,notebookDropdownHoverExpand:!1,privacy:{autoOpenLastNote:!0,autoCloseInactiveTabs:!1,autoCloseInactiveTabsHours:24},customActions:[],dismissedNotices:{}};function Et(e){return{...Tt,toggleSearchProvider:t=>e(e=>({searchProviders:e.searchProviders.map(e=>e.id===t?{...e,isEnabled:!e.isEnabled}:e)})),reorderSearchProviders:t=>e(e=>{let n=new Map(e.searchProviders.map(e=>[e.id,e])),r=[],i=new Set;return t.forEach(e=>{let t=n.get(e);!t||i.has(e)||(r.push(t),i.add(e))}),e.searchProviders.forEach(e=>{i.has(e.id)||r.push(e)}),{searchProviders:r}}),addCustomSearchProvider:({name:t,urlTemplate:n})=>{let r=t.trim().slice(0,30),i=n.trim();!r||de(i)||e(e=>({searchProviders:[...e.searchProviders,{id:`custom-search-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:r,urlTemplate:i,isEnabled:!0,isCustom:!0}]}))},updateCustomSearchProvider:(t,{name:n,urlTemplate:r})=>{let i=n.trim().slice(0,30),a=r.trim();!i||de(a)||e(e=>({searchProviders:e.searchProviders.map(e=>e.id===t&&e.isCustom?{...e,name:i,urlTemplate:a}:e)}))},removeCustomSearchProvider:t=>e(e=>({searchProviders:e.searchProviders.filter(e=>e.id!==t||!e.isCustom)})),setSearchAllNotebooks:t=>e({searchAllNotebooks:t}),setShowRecentInSearch:t=>e({showRecentInSearch:t}),setNotebookDropdownHoverExpand:t=>e({notebookDropdownHoverExpand:t}),setAutoOpenLastNote:t=>e(e=>({privacy:{...e.privacy,autoOpenLastNote:t}})),setAutoCloseInactiveTabs:t=>e(e=>({privacy:{...e.privacy,autoCloseInactiveTabs:t}})),setAutoCloseInactiveTabsHours:t=>e(e=>({privacy:{...e.privacy,autoCloseInactiveTabsHours:c(t)}})),addCustomAction:t=>e(e=>({customActions:[...e.customActions,{...t,id:Date.now().toString()}]})),updateCustomAction:(t,n)=>e(e=>({customActions:e.customActions.map(e=>{if(e.id!==t)return e;let r={...e,...n};return r.name.trim()||(r.isEnabled=!1),r})})),removeCustomAction:t=>e(e=>({customActions:e.customActions.filter(e=>e.id!==t)})),dismissNotice:t=>e(e=>({dismissedNotices:{...e.dismissedNotices,[t]:!0}}))}}var Dt={localFolderFileManager:``,localFolderExternalEditor:``,localFolderTerminal:``,localFolderHiddenFolders:[`assets`]};function Ot(e){return{...Dt,setLocalFolderFileManager:t=>e({localFolderFileManager:t}),setLocalFolderExternalEditor:t=>e({localFolderExternalEditor:t}),setLocalFolderTerminal:t=>e({localFolderTerminal:t}),setLocalFolderHiddenFolders:t=>e({localFolderHiddenFolders:t})}}var kt={webdavUrl:`https://example.com/dav/`,webdavUsername:``,webdavPassword:``,webdavRemoteDir:`goose-notes`,webdavRetentionDays:365,webdavAutoBackupEnabled:!0,webdavLastUploadAt:null,webdavLastUploadFilename:null,webdavLastDownloadAt:null,webdavLastDownloadFilename:null};function At(e){return{...kt,updateWebdavSettings:t=>e(e=>({...e,...t})),clearWebdavPassword:()=>e({webdavPassword:``})}}var jt=/\uFFFC/g;function Mt(e){return e.replace(jt,``)}function R(e){return Mt(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}var Nt={gray:`#9b9a97`,brown:`#64473a`,red:`#e03e3e`,orange:`#d9730d`,yellow:`#dfab01`,green:`#4d6461`,blue:`#0b6e99`,purple:`#6940a5`,pink:`#ad1a72`},Pt={gray:`#ebeced`,brown:`#e9e5e3`,red:`#fbe4e4`,orange:`#f6e9d9`,yellow:`#fbf3db`,green:`#ddedea`,blue:`#ddebf1`,purple:`#eae4f2`,pink:`#f4dfeb`},Ft={gray:`#d6d4cf`,brown:`#e7c1ad`,red:`#ffb4b8`,orange:`#ffc38f`,yellow:`#f0d77d`,green:`#9ddfba`,blue:`#9bd5f3`,purple:`#d0baf8`,pink:`#f1b6d7`},It={gray:`#3d3d3a`,brown:`#49352c`,red:`#512b31`,orange:`#50351f`,yellow:`#453a1e`,green:`#253f34`,blue:`#223f52`,purple:`#3b3055`,pink:`#4b2c42`};function z(e,t){return typeof e!=`string`||e===``||e==="default"?null:t[e]||e}function Lt(){return`https://fonts.googleapis.com/css2?family=${[`Inter:wght@400;500;600;700;800;900`,`Noto+Sans+SC:wght@300;400;500;600;700;800;900`,`Noto+Serif+SC:wght@400;600;700`,`JetBrains+Mono:wght@400;500`,`Courier+Prime:wght@400;700`,`ZCOOL+XiaoWei`,`Ma+Shan+Zheng`,`Space+Grotesk:wght@400;500;600;700`,`Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700`,`IBM+Plex+Sans:wght@400;500;600`,`IBM+Plex+Mono:wght@400;500`].join(`&family=`)}&display=swap`}function Rt(e){let t=e.trim(),n=/^#([0-9a-f]{3})$/i.exec(t),r=/^#([0-9a-f]{6})$/i.exec(t),i,a,o;if(n)i=parseInt(n[1][0]+n[1][0],16),a=parseInt(n[1][1]+n[1][1],16),o=parseInt(n[1][2]+n[1][2],16);else if(r)i=parseInt(r[1].slice(0,2),16),a=parseInt(r[1].slice(2,4),16),o=parseInt(r[1].slice(4,6),16);else if(/^rgba?\(/i.test(t)){let e=t.replace(/rgba?\(/i,``).replace(/\)/,``).split(`,`).map(e=>parseFloat(e.trim()));if(e.length<3||e.some(e=>!Number.isFinite(e)))return`#ffffff`;i=e[0],a=e[1],o=e[2]}else return`#ffffff`;let s=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},c=.2126*s(i)+.7152*s(a)+.0722*s(o);return(c+.05)/.053>=1.05/(c+.05)?`#0a0a0a`:`#ffffff`}function zt(e){let t=e.bodyFontSize;return{h1:Math.max(Math.round(e.titleFontSize*.85),Math.round(t*1.75)),h2:Math.max(Math.round(e.titleFontSize*.7),Math.round(t*1.4)),h3:Math.max(Math.round(e.titleFontSize*.58),Math.round(t*1.22))}}function Bt(e){let t=e.titleFontWeight;return{h1:Math.min(Math.max(t,600),900),h2:Math.min(Math.max(t-100,600),800),h3:Math.min(Math.max(t-200,600),700)}}function B(e){let{title:t,blocksHtml:n,theme:r}=e,i=I(e.watermarkConfig),a=r,o=zt(a),s=Bt(a),c=Rt(a.accent),l=(e.titleInlineStyle||``).trim(),u=l.includes(`background-color`),d=l?` style="${l}"`:``,f=u?` class="gooseshot-title has-block-bg"`:` class="gooseshot-title"`,p=a.showDecorations?`
    .gooseshot-container::before {
      content: '';
      position: absolute;
      top: -120px; right: -80px;
      width: 360px; height: 360px;
      background: radial-gradient(circle, ${a.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }
    .gooseshot-container::after {
      content: '';
      position: absolute;
      bottom: -100px; left: -60px;
      width: 280px; height: 280px;
      background: radial-gradient(circle, ${a.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }`:``,m=`
    font-family: ${a.titleFont};
    font-size: ${a.titleFontSize}px;
    font-weight: ${a.titleFontWeight};
    line-height: ${a.titleLineHeight};
    letter-spacing: ${a.titleLetterSpacing};
    color: ${a.textColor};
    text-align: ${a.titleAlign};
  `;return`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${Lt()}">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
${e.preview?`html, body { background: transparent; }`:``}
body {
  font-family: ${a.bodyFont};
  color: ${a.textColor};
  line-height: ${a.bodyLineHeight};
  font-size: ${a.bodyFontSize}px;
  letter-spacing: ${a.bodyLetterSpacing};
}
.gooseshot-container {
  background: ${a.background};
  padding: ${a.containerPaddingY}px ${a.containerPaddingX}px;
  min-width: 680px;
  max-width: 1200px;
  position: relative;
  overflow: hidden;
}
${p}
.gooseshot-card {
  background: ${a.cardBg};
  border-radius: ${a.cardRadius}px;
  padding: ${a.cardPaddingY}px ${a.cardPaddingX}px;
  box-shadow: ${a.cardShadow};
  position: relative;
  z-index: 1;
  border: ${a.cardBorder};
}
.gooseshot-header { margin-bottom: 24px; padding-bottom: 0; border-bottom: none; }
.gooseshot-title { ${m} }
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
  font-family: ${a.titleFont};
  color: ${a.textColor};
  letter-spacing: ${a.titleLetterSpacing};
  text-wrap: balance;
}
.gooseshot-content h1 {
  font-size: ${o.h1}px;
  font-weight: ${s.h1};
  line-height: ${Math.max(a.titleLineHeight,1.2)};
  margin-top: 28px;
  margin-bottom: 14px;
}
.gooseshot-content h2 {
  font-size: ${o.h2}px;
  font-weight: ${s.h2};
  line-height: 1.3;
  margin-top: 24px;
  margin-bottom: 12px;
}
.gooseshot-content h3 {
  font-size: ${o.h3}px;
  font-weight: ${s.h3};
  line-height: 1.35;
  margin-top: 20px;
  margin-bottom: 10px;
}
.gooseshot-content > h1:first-child,
.gooseshot-content > h2:first-child,
.gooseshot-content > h3:first-child { margin-top: 0; }
.gooseshot-content p {
  margin-bottom: 12px;
  line-height: ${a.bodyLineHeight};
}
/* 空段落：占满一行正文高度，避免空行塌缩 */
.gooseshot-content .empty-block {
  min-height: calc(1em * ${a.bodyLineHeight});
  margin-bottom: 12px;
  line-height: ${a.bodyLineHeight};
}
.gooseshot-content p:empty {
  min-height: calc(1em * ${a.bodyLineHeight});
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
  line-height: ${a.bodyLineHeight};
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
.gooseshot-content code {
  font-family: ${a.codeFont};
  font-size: 0.86em;
  background: ${a.codeBg};
  padding: 2px 6px;
  border-radius: 4px;
  color: ${a.codeTextColor??a.textColor};
}
.gooseshot-content pre {
  background: ${a.codeBg};
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${a.tableBorder};
  color: ${a.codeTextColor??a.textColor};
}
.gooseshot-content pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  font-family: ${a.codeFont};
  color: inherit;
}
.gooseshot-content .code-block {
  background: ${a.codeBg};
  border-radius: 10px;
  padding: 14px 16px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${a.tableBorder};
  color: ${a.codeTextColor??a.textColor};
  font-family: ${a.codeFont};
}
.gooseshot-content .code-lang {
  font-size: 11px;
  color: ${a.secondaryText};
  margin-bottom: 6px;
  font-family: ${a.bodyFont};
  line-height: 1.4;
}
.gooseshot-content .code-summary {
  font-size: 12px;
  color: ${a.secondaryText};
  margin-bottom: 8px;
  font-family: ${a.bodyFont};
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
  border-left: 3px solid ${a.quoteBorder};
  padding-left: 18px;
  margin: 16px 0;
  color: ${a.secondaryText};
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
  color: ${a.secondaryText};
  font-size: 0.9em;
  text-align: center;
  line-height: 1.5;
}
.gooseshot-content .file-card {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  background: ${a.calloutBg};
  border: 1px solid ${a.tableBorder};
  border-radius: 10px;
  margin: 14px 0;
}
.gooseshot-content .file-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
.gooseshot-content .file-body { min-width: 0; flex: 1; }
.gooseshot-content .file-name { font-weight: 500; color: ${a.textColor}; }
.gooseshot-content .file-caption {
  font-size: 0.9em;
  color: ${a.secondaryText};
  margin-top: 2px;
}
.gooseshot-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}
.gooseshot-content th, .gooseshot-content td {
  border: 1px solid ${a.tableBorder};
  padding: 8px 12px;
  text-align: left;
}
.gooseshot-content th {
  background: ${a.codeBg};
  font-weight: 600;
  color: ${a.codeTextColor??a.textColor};
}
.gooseshot-content .media-fallback {
  color: ${a.secondaryText};
  font-size: 0.95em;
  margin: 12px 0;
}
.gooseshot-content hr {
  border: none;
  border-top: 1px solid ${a.divider};
  margin: 20px 0;
}
.gooseshot-content .callout {
  background: ${a.calloutBg};
  border: 1px solid currentColor;
  border-radius: 10px;
  padding: 14px 18px;
  margin: 14px 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  color: ${a.textColor};
  break-inside: avoid;
}
.gooseshot-content .callout-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  height: ${a.bodyFontSize*a.bodyLineHeight}px;
  display: flex;
  align-items: center;
}
.gooseshot-content .callout-text {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  line-height: ${a.bodyLineHeight};
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
  color: ${a.secondaryText};
  line-height: inherit;
}
.gooseshot-content .toggle-children {
  margin-left: 22px;
  margin-top: 6px;
  border-left: 2px solid ${a.divider};
  padding-left: 14px;
}
.gooseshot-content .nested-children > *,
.gooseshot-content .toggle-children > * { margin-bottom: 8px; }
.gooseshot-content .nested-children > *:last-child,
.gooseshot-content .toggle-children > *:last-child { margin-bottom: 0; }
.gooseshot-content .callout-text pre,
.gooseshot-content .nested-children table,
.gooseshot-content .toggle-children table { max-width: 100%; }
.gooseshot-watermark {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid ${a.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gooseshot-watermark-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gooseshot-watermark-icon { font-size: 16px; line-height: 1; }
.gooseshot-watermark-brand {
  color: ${a.watermark};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.gooseshot-watermark-date {
  color: ${a.watermark};
  font-size: 11px;
  font-weight: 400;
}
.gooseshot-content strong { font-weight: 600; }
.gooseshot-content em { font-style: italic; }
.gooseshot-content del { text-decoration: line-through; }
.gooseshot-content a {
  color: ${a.accent};
  text-decoration: none;
}
.gooseshot-content a:hover { text-decoration: underline; }
.gooseshot-content .task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin-bottom: 0.35em;
  line-height: ${a.bodyLineHeight};
  font-size: ${a.bodyFontSize}px;
  color: ${a.textColor};
  break-inside: avoid;
}
.gooseshot-content .task-checkbox-wrap {
  height: ${a.bodyLineHeight}em;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.gooseshot-content .task-checkbox {
  width: 1em;
  height: 1em;
  border: 1.5px solid currentColor;
  background: transparent;
  border-radius: 0.22em;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.gooseshot-content .task-checkbox.checked {
  background: ${a.accent};
  border-color: ${a.accent};
}
.gooseshot-content .task-checkbox.checked::after {
  content: '✓';
  color: ${c};
  font-size: 0.72em;
  line-height: 1;
  font-weight: 700;
}
.gooseshot-content .task-item.checked .task-text {
  color: ${a.secondaryText};
  text-decoration: none;
}
.gooseshot-content .task-text {
  flex: 1;
  min-width: 0;
  line-height: ${a.bodyLineHeight};
}
</style>
</head>
<body>
<div class="gooseshot-container">
  <div class="gooseshot-card">
    ${i.showTitle?`<div class="gooseshot-header">
      <div${f}${d}>${R(t||`无标题`)}</div>
    </div>`:``}
    <div class="gooseshot-content">
      ${n}
    </div>
    ${mt(r,i)}
  </div>
</div>
</body>
</html>`}function Vt(e){return e?.mode===`dark`?Ft:Nt}function Ht(e){return e?.mode===`dark`?It:Pt}function V(e,t){let n=[],r=e?.props?.textAlignment;(r===`center`||r===`right`||r===`justify`)&&n.push(`text-align:${r}`);let i=z(e?.props?.textColor,Vt(t));i&&n.push(`color:${i}`);let a=z(e?.props?.backgroundColor,Ht(t));return a&&n.push(`background-color:${a}`),n.join(`;`)}function Ut(e,t){let n=V(e,t);return n?` style="${n}"`:``}function Wt(e){return e&&typeof e==`object`&&!Array.isArray(e)&&e.props?e.props:{}}function Gt(e,t){let n=Wt(e),r=[],i=Number(n.colspan??n.colSpan),a=Number(n.rowspan??n.rowSpan);Number.isInteger(i)&&i>1&&r.push(`colspan="${i}"`),Number.isInteger(a)&&a>1&&r.push(`rowspan="${a}"`);let o=Ut({props:n},t).trim();return o&&r.push(o),r.length?` ${r.join(` `)}`:``}function Kt(e){if(!e)return!1;if(e.startsWith(`data:image/`))return!0;let t=e.split(`?`)[0].split(`#`)[0].toLowerCase();return/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(t)}function qt(e){return typeof e==`string`?e:Array.isArray(e)?e.map(e=>typeof e==`string`?e:!e||typeof e!=`object`?``:e.type===`hardBreak`?`
`:typeof e.text==`string`?e.text:``).join(``):e==null?``:String(e)}function Jt(e,t){return e==null?``:typeof e==`string`?R(e).replace(/\n/g,`<br>`):typeof e==`object`&&!Array.isArray(e)&&Array.isArray(e.content)?Jt(e.content,t):Array.isArray(e)?e.some(e=>e&&typeof e==`object`&&e.type===`paragraph`)?e.map(e=>e?.type===`paragraph`?G(e.content,t):G([e],t)).join(`<br>`):G(e,t):typeof e==`object`&&e.text?R(String(e.text)).replace(/\n/g,`<br>`):R(Yt(e)).replace(/\n/g,`<br>`)}function H(e,t,n=`nested-children`){let r=e?.children;if(!Array.isArray(r)||r.length===0)return``;let i=U(r,t);return i?`<div class="${n}">${i}</div>`:``}function U(e,t){if(!Array.isArray(e)||e.length===0)return``;let n=[],r=0;for(;r<e.length;){let i=e[r];if(i?.type===`bulletListItem`){let i=[];for(;r<e.length&&e[r]?.type===`bulletListItem`;)i.push(e[r]),r+=1;n.push(`<ul class="bn-list">${i.map(e=>W(e,t)).join(``)}</ul>`);continue}if(i?.type===`numberedListItem`){let i=[];for(;r<e.length&&e[r]?.type===`numberedListItem`;)i.push(e[r]),r+=1;let a=Number(i[0]?.props?.start),o=Number.isInteger(a)&&a>1?` start="${a}"`:``;n.push(`<ol class="bn-list"${o}>${i.map(e=>W(e,t)).join(``)}</ol>`);continue}n.push(W(i,t)),r+=1}return n.join(`
`)}function W(e,t){if(!e||typeof e!=`object`)return``;let n=G(e.content,t),r=Ut(e,t);switch(e.type){case`heading`:{let i=Math.min(Math.max(Number(e.props?.level)||1,1),3),a=!!e.props?.isToggleable,o=a?`<span class="toggle-marker">▾</span><span>${n}</span>`:n;return`${a?`<h${i}${r}><div class="toggle-summary">${o}</div></h${i}>`:`<h${i}${r}>${o}</h${i}>`}${H(e,t)}`}case`bulletListItem`:{let i=e.children?.length?U(e.children,t):``,a=i?i.trimStart().startsWith(`<ul`)||i.trimStart().startsWith(`<ol`)?i:`<div class="nested-children">${i}</div>`:``;return`<li${r}>${n||``}${a}</li>`}case`numberedListItem`:{let i=e.children?.length?U(e.children,t):``,a=i?i.trimStart().startsWith(`<ul`)||i.trimStart().startsWith(`<ol`)?i:`<div class="nested-children">${i}</div>`:``,o=Number(e.props?.start);return`<li${Number.isInteger(o)&&o>0?` value="${o}"`:``}${r}>${n||``}${a}</li>`}case`checkListItem`:{let i=!!e.props?.checked;return`${`<div class="${i?`task-item checked`:`task-item`}"${r}><div class="task-checkbox-wrap"><div class="${i?`task-checkbox checked`:`task-checkbox`}"></div></div><span class="task-text">${n}</span></div>`}${H(e,t)}`}case`codeBlock`:{let t=(e.props?.language||``).trim(),n=R(qt(e.content)),r=e.props?.wrap===!0,i=e.props?.collapsed===!0,a=typeof e.props?.summary==`string`?e.props.summary.trim():``,o=t&&t!==`text`&&t!==`plain`,s=r?` class="code-wrap"`:``,c=[t?` data-lang="${R(t)}"`:``,i?` data-collapsed="true"`:``].join(``),l=i&&a?`<div class="code-summary">${R(a)}</div>`:``;return`<div class="code-block"${c}>${o?`<div class="code-lang">${R(t)}</div>`:``}${l}<pre${s}><code${t?` class="language-${R(t)}"`:``}>${n}</code></pre></div>`}case`quote`:return`<blockquote${r}>${n}</blockquote>${H(e,t)}`;case`paragraph`:return n?`<p${r}>${n}</p>${H(e,t)}`:`<p class="empty-block" data-empty="true"${r}><br></p>${H(e,t)}`;case`image`:case`imageResize`:{let t=e.props?.url||e.props?.src||``,n=e.props?.caption||e.props?.alt||``;if(!t)return n?`<p class="media-fallback"${r}>${R(n)}</p>`:``;let i=e.props?.textAlignment||e.props?.alignment,a=i===`center`?`display:block;margin-left:auto;margin-right:auto;`:i===`right`?`display:block;margin-left:auto;`:``,o=Number(e.props?.previewWidth??e.props?.width),s=Number.isFinite(o)&&o>0?`max-width:${o}px;`:``,c=`<img src="${R(t)}" alt="${R(n)}" style="${a}${s}" />`;return n?`<figure class="export-figure"${r}>${c}<figcaption>${R(n)}</figcaption></figure>`:c}case`file`:{let t=e.props?.url||e.props?.src||``,n=e.props?.name||e.props?.caption||`附件`,i=e.props?.caption||``;if(t&&Kt(t)){let e=`<img src="${R(t)}" alt="${R(i||n)}" />`;return i||n?`<figure class="export-figure"${r}>${e}<figcaption>${R(i||n)}</figcaption></figure>`:e}return`<div class="file-card"${r}><span class="file-icon">📎</span><div class="file-body">${t?`<a class="file-name" href="${R(t)}">${R(n)}</a>`:`<span class="file-name">${R(n)}</span>`}${i&&i!==n?`<div class="file-caption">${R(i)}</div>`:``}</div></div>`}case`table`:{let n=e.content?.rows||[];if(!n.length)return``;let i=Number(e.content?.headerRows),a=Number.isFinite(i)&&i>=0?Math.floor(i):1,o=Number(e.content?.headerCols),s=Number.isFinite(o)&&o>0?Math.floor(o):0;return`<table${r}><tbody>${n.map((e,n)=>`<tr>${(e.cells||[]).map((e,r)=>{let i=n<a||r<s?`th`:`td`;return`<${i}${Gt(e,t)}>${Jt(e,t)}</${i}>`}).join(``)}</tr>`).join(``)}</tbody></table>`}case`divider`:return`<hr />`;case`toggleListItem`:return`<div class="toggle-block"${r}>${`<div class="toggle-summary"><span class="toggle-marker">▾</span><span>${n}</span></div>`}${H(e,t,`toggle-children`)}</div>`;case`callout`:{let i=ne(e.props?.icon||e.props?.emoji),a=H(e,t);return`<div class="callout"${r}><div class="callout-icon">${R(i)}</div><div class="callout-text">${n}${a}</div></div>`}case`bulletList`:return`<ul class="bn-list">${(e.content||e.children||[]).map(e=>W(e,t)).join(``)}</ul>`;case`orderedList`:{let n=e.content||e.children||[],r=Number(e.props?.start??e.attrs?.start);return`<ol class="bn-list"${Number.isInteger(r)&&r>1?` start="${r}"`:``}>${n.map(e=>W(e,t)).join(``)}</ol>`}case`video`:{let t=e.props?.url||e.props?.src||``,n=e.props?.name||e.props?.caption||`视频`;return t?`<p class="media-fallback"${r}><a href="${R(t)}">▶ ${R(n)}</a></p>`:`<p class="media-fallback"${r}>▶ ${R(n)}</p>`}case`audio`:{let t=e.props?.url||e.props?.src||``,n=e.props?.name||e.props?.caption||`音频`;return t?`<p class="media-fallback"${r}><a href="${R(t)}">♪ ${R(n)}</a></p>`:`<p class="media-fallback"${r}>♪ ${R(n)}</p>`}default:return`${n?`<p${r}>${n}</p>`:``}${H(e,t)}`}}function G(e,t){return typeof e==`string`?R(e).replace(/\n/g,`<br>`):Array.isArray(e)?e.map(e=>{if(typeof e==`string`)return R(e).replace(/\n/g,`<br>`);if(!e||typeof e!=`object`)return``;if(e.type===`hardBreak`)return`<br>`;if(e.type===`link`){let n=e.href||e.attrs?.href||``,r=G(e.content,t)||R(e.text||n);return n?`<a href="${R(n)}">${r}</a>`:r}if(e.type===`image`&&e.attrs?.src){let t=e.attrs.src,n=e.attrs.alt||``;return`<img src="${R(t)}" alt="${R(n)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;vertical-align:middle;" />`}if(e.type===`inlineMath`&&e.attrs?.value)return`<code class="inline-math">${R(e.attrs.value)}</code>`;let n=R(e.text||``).replace(/\n/g,`<br>`),r=e.styles||{},i=e.marks||[],a=n;(r.bold||i.some(e=>e?.type===`bold`))&&(a=`<strong>${a}</strong>`),(r.italic||i.some(e=>e?.type===`italic`))&&(a=`<em>${a}</em>`),(r.underline||i.some(e=>e?.type===`underline`))&&(a=`<u>${a}</u>`),(r.strike||i.some(e=>e?.type===`strike`))&&(a=`<del>${a}</del>`),(r.code||i.some(e=>e?.type===`code`))&&(a=`<code>${a}</code>`);let o=i.find(e=>e?.type===`link`);o?.attrs?.href&&(a=`<a href="${R(o.attrs.href)}">${a}</a>`);let s=z(r.textColor||i.find(e=>e?.type===`textColor`)?.attrs?.color||i.find(e=>e?.type===`textColor`)?.attrs?.stringValue||i.find(e=>e?.type===`textStyle`)?.attrs?.color||r.color,Vt(t));s&&(a=`<span style="color:${R(s)}">${a}</span>`);let c=z(r.backgroundColor||i.find(e=>e?.type===`backgroundColor`)?.attrs?.color||i.find(e=>e?.type===`backgroundColor`)?.attrs?.stringValue||i.find(e=>e?.type===`highlight`)?.attrs?.color,Ht(t));return c&&(a=`<span style="background-color:${R(c)};border-radius:2px;padding:0 2px;">${a}</span>`),a}).join(``):``}function K(e){return typeof e==`string`?e:Array.isArray(e)?e.map(e=>typeof e==`string`?e:!e||typeof e!=`object`?``:e.type===`hardBreak`?`
`:e.type===`link`?K(e.content)||e.text||``:e.type===`inlineMath`&&e.attrs?.value?e.attrs.value:e.text||``).join(``):``}function Yt(e){if(typeof e==`string`)return e;if(Array.isArray(e))return e.map(e=>typeof e==`string`?e:e?.type===`link`?K(e.content)||e.text||``:e?.text?e.text:e?.type===`paragraph`?K(e.content):``).join(``);if(e?.text)return e.text;if(e?.content){if(typeof e.content==`string`)return e.content;if(Array.isArray(e.content))return Yt(e.content)}return``}function Xt(e){let t=e?.content;return typeof t==`string`?t:Array.isArray(t)?t.map(e=>typeof e==`string`?e:!e||typeof e!=`object`?``:e.type===`hardBreak`?`
`:typeof e.text==`string`?e.text:``).join(``):t==null?``:String(t)}async function Zt(e,t){let{captureElementAsPngBlob:n}=await he(async()=>{let{captureElementAsPngBlob:e}=await import(`./svgToPng.js`).then(e=>e.i);return{captureElementAsPngBlob:e}},__vite__mapDeps([0,1,2,3,4,5]),import.meta.url),r=document.createElement(`div`);r.style.cssText=[`position:fixed`,`left:-99999px`,`top:0`,`z-index:-1`,`padding:16px 24px`,`color:${t.textColor}`,`background:transparent`,`font-size:18px`,`line-height:1.4`,`display:inline-block`].join(`;`),r.innerHTML=e,document.body.appendChild(r);try{await document.fonts.ready,await new Promise(e=>requestAnimationFrame(()=>e()));let e=await n(r);return await new Promise((t,n)=>{let r=new FileReader;r.onload=()=>t(String(r.result??``)),r.onerror=()=>n(Error(`公式图片编码失败`)),r.readAsDataURL(e)})}finally{document.body.removeChild(r)}}async function Qt(e,t){if(e?.type!==`codeBlock`||e.props?.language!==`math`)return;let n=Xt(e).trim();if(n)try{let{default:r}=await he(async()=>{let{default:e}=await import(`./vendor-katex~katex.js`).then(e=>e.t);return{default:e}},__vite__mapDeps([6,1]),import.meta.url);if(typeof document<`u`&&!document.getElementById(`goose-katex-css`))try{let e=document.createElement(`link`);e.id=`goose-katex-css`,e.rel=`stylesheet`,e.href=`https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css`,document.head.appendChild(e),await new Promise(t=>{e.onload=()=>t(),e.onerror=()=>t(),setTimeout(()=>t(),1500)})}catch{}let i=await Zt(r.renderToString(n,{displayMode:!0,throwOnError:!1,output:`html`}),t);e.type=`image`,e.content=void 0,e.children=[],e.props={url:i,caption:`公式`,textAlignment:`center`}}catch(e){console.error(`[imageExport] math render failed:`,e)}}async function $t(e,t){for(let n of e)await Qt(n,t),Array.isArray(n?.children)&&n.children.length>0&&await $t(n.children,t)}async function en(e,t){!Array.isArray(e)||e.length===0||await $t(e,t)}function tn(e){return e.trim().replace(/\s+/g,` `)}function nn(e,t){if(!e||e.type!==`heading`||(Number(e.props?.level)||1)!==1)return!1;let n=tn(ge([e])),r=tn(t);return!!(n&&n===r)}function q(e){let{blocks:t,pageTitle:n,showTitle:r,mode:i}=e;if(!r||t.length===0)return{blocks:t,titleBlock:null};let a=t[0];return i===`selection`?nn(a,n)?{blocks:t.slice(1),titleBlock:a}:{blocks:t,titleBlock:null}:a?.type===`heading`?{blocks:t.slice(1),titleBlock:a}:{blocks:t,titleBlock:null}}var rn=3,J=.1,Y=16384,an=16e6,on=6e4,sn=3e4,cn=!1;function X(e,t,n){let r,i=new Promise((e,i)=>{r=setTimeout(()=>i(Error(n)),t)});return Promise.race([e,i]).finally(()=>{r!==void 0&&clearTimeout(r)})}function ln(e,t,n){if(n<J)return!1;let r=Math.ceil(e*n),i=Math.ceil(t*n);return r<=Y&&i<=Y&&r*i<=an}function un(e,t){let n=Math.max(1,Math.ceil(e)),r=Math.max(1,Math.ceil(t)),i=Math.min(Y/n,Y/r),a=Math.sqrt(an/(n*r)),o=Math.min(rn,i,a);for(o=Math.floor(o*1e4)/1e4;o>=J&&!ln(n,r,o);)o=Math.floor((o-1e-4)*1e4)/1e4;if(!ln(n,r,o))throw Error(`内容过长，无法导出为单张图片，请缩小内容范围后重试`);return o}function dn(e,t){let n=un(e,t),r=e=>Math.floor(e*1e4)/1e4,i=n>2?[n,2,1]:n>1?[n,1]:[n,Math.max(J,r(n*.75)),Math.max(J,r(n*.5))];return i.filter((e,t)=>e>=J&&i.findIndex(t=>t===e)===t)}function fn(e){let t=e.getBoundingClientRect();return dn(e.scrollWidth||t.width,e.scrollHeight||t.height)}function pn(e){return new Promise((t,n)=>{try{e.toBlob(e=>{e?t(e):n(Error(`图片编码失败`))},`image/png`)}catch(e){n(e)}})}function mn(e){e&&(e.width=1,e.height=1)}async function hn(){await new Promise(e=>{requestAnimationFrame(()=>requestAnimationFrame(()=>e()))})}async function gn(e){let t=fn(e),n;for(let r=0;r<t.length;r+=1){let i=t[r],a=null;try{return a=await X(ve(e,{pixelRatio:i,cacheBust:!1,skipFonts:!0,imagePlaceholder:`data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%2280%22%20viewBox%3D%220%200%20200%2080%22%3E%3Crect%20width%3D%22200%22%20height%3D%2280%22%20rx%3D%226%22%20fill%3D%22%23f3f4f6%22%2F%3E%3Ctext%20x%3D%22100%22%20y%3D%2244%22%20font-family%3D%22sans-serif%22%20font-size%3D%2213%22%20fill%3D%22%239ca3af%22%20text-anchor%3D%22middle%22%3E%E5%9B%BE%E7%89%87%E5%8A%A0%E8%BD%BD%E5%A4%B1%E8%B4%A5%3C%2Ftext%3E%3C%2Fsvg%3E`}),on,`生成图片超时`),await X(pn(a),on,`图片编码超时`)}catch(e){n=e,mn(a),a=null;let o=r<t.length-1,s=e instanceof Error&&/timeout|超时/i.test(e.message);if(!o||s)break;console.warn(`[imageExport] ${i}x capture failed, retrying at ${t[r+1]}x:`,e),await hn()}finally{mn(a)}}throw n instanceof Error?n:Error(`生成图片失败`)}function _n(e){let t=e instanceof Error?e.message.trim():``;return t?/timeout|超时/i.test(t)?`导出图片失败：${t}`:/内容过长|尺寸超出|图片编码|保存图片/.test(t)?t:`导出图片失败，请重试`:`导出图片失败，请重试`}function vn(){document.querySelectorAll(`#goose-image-export-loading`).forEach(e=>e.remove());let e=document.createElement(`div`);e.id=`goose-image-export-loading`,e.style.cssText=`
    position:fixed;inset:0;z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(8,8,14,0.6);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    animation:ge-in .5s cubic-bezier(.16,1,.3,1) both;
    overflow:hidden;
  `;let t=[`#58d7b8`,`#4f9cf7`,`#9b72f2`,`#f472b6`,`#ffb56a`,`#22d3ee`];return e.innerHTML=`<style>
@keyframes ge-in{from{opacity:0}to{opacity:1}}
@keyframes ge-out{to{opacity:0;transform:scale(1.06)}}
@keyframes ge-blob1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-28px) scale(1.1)}66%{transform:translate(-28px,32px) scale(.92)}}
@keyframes ge-blob2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-36px,28px) scale(1.14)}66%{transform:translate(32px,-36px) scale(.86)}}
@keyframes ge-blob3{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,36px) scale(.94)}66%{transform:translate(-36px,-16px) scale(1.1)}}
@keyframes ge-conic{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ge-glow{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.14);opacity:1}}
@keyframes ge-cw{to{transform:rotate(360deg)}}
@keyframes ge-ccw{to{transform:rotate(-360deg)}}
@keyframes ge-pulse{0%{transform:scale(.85);opacity:.5}50%{transform:scale(1.3);opacity:0}100%{transform:scale(.85);opacity:0}}
@keyframes ge-pulse2{0%{transform:scale(.85);opacity:.4}50%{transform:scale(1.4);opacity:0}100%{transform:scale(.85);opacity:0}}
@keyframes ge-float{0%{transform:translateY(0) scale(1);opacity:0}12%{opacity:.8}80%{opacity:.5}100%{transform:translateY(-150px) scale(.2);opacity:0}}
@keyframes ge-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes ge-enter{from{transform:scale(.55);opacity:0}to{transform:scale(1);opacity:1}}
@media(prefers-reduced-motion:reduce){#goose-image-export-loading,#goose-image-export-loading *{animation-duration:.01s!important;animation-iteration-count:1!important}}
</style>

<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
  <div style="position:absolute;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(88,215,184,.22),transparent 70%);top:calc(50% - 240px);left:calc(50% - 90px);filter:blur(72px);animation:ge-blob1 8s ease-in-out infinite;will-change:transform"></div>
  <div style="position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(159,114,242,.22),transparent 70%);top:calc(50% - 60px);left:calc(50% + 40px);filter:blur(72px);animation:ge-blob2 10s ease-in-out infinite;will-change:transform"></div>
  <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,181,106,.18),transparent 70%);top:calc(50% - 180px);left:calc(50% - 240px);filter:blur(72px);animation:ge-blob3 12s ease-in-out infinite;will-change:transform"></div>
</div>

<div style="position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;animation:ge-enter .65s cubic-bezier(.16,1,.3,1) .08s both">
  <div style="position:absolute;inset:-46px;border-radius:50%;border:.5px solid rgba(255,181,106,.1);animation:ge-cw 22s linear infinite;will-change:transform"></div>
  <div style="position:absolute;inset:-28px;border-radius:50%;border:1px solid rgba(159,114,242,.16);animation:ge-ccw 13s linear infinite;will-change:transform"></div>
  <div style="position:absolute;inset:-12px;border-radius:50%;border:1.5px dashed rgba(88,215,184,.28);animation:ge-cw 5.5s linear infinite;will-change:transform"></div>

  <div style="position:absolute;width:80px;height:80px;border-radius:50%;border:1.5px solid rgba(88,215,184,.25);animation:ge-pulse 2.8s ease-out infinite;will-change:transform,opacity"></div>
  <div style="position:absolute;width:80px;height:80px;border-radius:50%;border:1.5px solid rgba(159,114,242,.2);animation:ge-pulse2 2.8s ease-out 1.4s infinite;will-change:transform,opacity"></div>

  <div style="position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;animation:ge-glow 2.6s ease-in-out infinite;will-change:transform,opacity">
    <div style="position:absolute;inset:-30%;width:160%;height:160%;top:50%;left:50%;background:conic-gradient(from 0deg,#58d7b8,#4f9cf7,#9b72f2,#f472b6,#ffb56a,#22d3ee,#58d7b8);animation:ge-conic 3s linear infinite;will-change:transform"></div>
    <div style="position:absolute;inset:5px;border-radius:50%;background:rgba(10,10,18,.88);backdrop-filter:blur(4px)"></div>
  </div>

  <div style="position:absolute;inset:-8px;animation:ge-cw 3.2s linear infinite;will-change:transform"><div style="position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:#58d7b8;box-shadow:0 0 10px rgba(88,215,184,.8)"></div></div>
  <div style="position:absolute;inset:-22px;animation:ge-ccw 5s linear infinite;will-change:transform"><div style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#ffb56a;box-shadow:0 0 8px rgba(255,181,106,.8)"></div></div>
  <div style="position:absolute;inset:-38px;animation:ge-cw 7.5s linear infinite;will-change:transform"><div style="position:absolute;top:50%;right:-2px;transform:translateY(-50%);width:4px;height:4px;border-radius:50%;background:#9b72f2;box-shadow:0 0 8px rgba(159,114,242,.7)"></div></div>
  <div style="position:absolute;inset:-16px;animation:ge-cw 4s linear infinite;will-change:transform"><div style="position:absolute;left:-2px;top:50%;transform:translateY(-50%);width:3px;height:3px;border-radius:50%;background:#f472b6;box-shadow:0 0 6px rgba(244,114,182,.7)"></div></div>
</div>

<div style="margin-top:30px;font-size:15px;font-weight:600;letter-spacing:.05em;background:linear-gradient(90deg,#58d7b8,#4f9cf7,#9b72f2,#f472b6,#ffb56a,#58d7b8);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:ge-shimmer 2.5s linear infinite,ge-enter .65s cubic-bezier(.16,1,.3,1) .18s both">正在生成图片</div>

<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">${Array.from({length:14},(e,n)=>{let r=t[n%t.length],i=34+n*2.4,a=2+n%3,o=(n*.32).toFixed(1),s=(3+n%4*.8).toFixed(1);return`<div style="position:absolute;left:${i}%;bottom:38%;width:${a}px;height:${a}px;border-radius:50%;background:${r};box-shadow:0 0 ${a*3}px ${r};opacity:0;animation:ge-float ${s}s ease-out ${o}s infinite;will-change:transform,opacity"></div>`}).join(``)}</div>`,document.body.appendChild(e),e}function yn(e){e.isConnected&&(e.style.animation=`ge-out .4s cubic-bezier(.33,1,.68,1) forwards`,setTimeout(()=>e.remove(),420))}async function bn(e){let t=e.querySelectorAll(`img`);if(t.length===0)return Promise.resolve();let n=Array.from(t).map(e=>new Promise(t=>{if(e.complete){t();return}e.onload=()=>t(),e.onerror=()=>t(),setTimeout(()=>t(),3e3)}));return Promise.all(n).then(()=>{})}async function xn(e,t){if(cn){x.info(`图片正在生成，请稍候`);return}cn=!0;let n=vn();try{await X(Promise.all([document.fonts.ready,bn(e)]),1e4,`等待图片资源超时`),await new Promise(e=>requestAnimationFrame(()=>e(void 0)));let n=await gn(e),{saveBlobAndReveal:r}=await he(async()=>{let{saveBlobAndReveal:e}=await import(`./export.js`).then(e=>e.t);return{saveBlobAndReveal:e}},__vite__mapDeps([7,1,2,3,4,5,8,9,10,11,12,13,14,15,16,17,18,19,20,0,21,22,23,24,25,26,27]),import.meta.url);if(await X(r(n,t),sn,`保存图片超时`))x.success(`图片已保存到下载文件夹`);else throw Error(`保存图片失败`)}catch(e){x.error(_n(e)),console.error(`[imageExport] capture failed:`,e)}finally{cn=!1,yn(n)}}function Sn(e){return e.replace(/[\\/:*?"<>|]/g,`_`)||`untitled`}function Cn(e,t,n){let r=new Date,i=e=>String(e).padStart(2,`0`),a=String(r.getMilliseconds()).padStart(3,`0`),o=`${r.getFullYear()}${i(r.getMonth()+1)}${i(r.getDate())}_${i(r.getHours())}${i(r.getMinutes())}${i(r.getSeconds())}_${a}`,s=[Sn(e||`untitled`),Sn(t.nameEn),o];return n&&s.splice(1,0,n),`${s.join(`_`)}.png`}function wn(e){let t=typeof document<`u`&&document.documentElement.classList.contains(`dark`),n=typeof document>`u`?void 0:Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--editor-font-size`));return{fontFamily:e?.fontFamily??`default`,editorFontSize:Number.isFinite(n)?n:void 0,resolvedTheme:t?`dark`:`light`}}async function Tn(e,t=`notebook`,n){let r=dt(t,wn(e)),i=I(n),a=_e(e)||S(e.content),o=C(e.content,{ensureFirstTitle:!e.localFilePath});await ye(o),await be(o,r),await en(o,r);let s=document.createElement(`div`);s.style.position=`fixed`,s.style.left=`-99999px`,s.style.top=`0`,s.style.zIndex=`-1`,document.body.appendChild(s);try{let{blocks:e,titleBlock:t}=q({blocks:o,pageTitle:a,showTitle:i.showTitle,mode:`page`});s.innerHTML=B({title:a,blocksHtml:U(e,r),theme:r,watermarkConfig:i,titleInlineStyle:V(t,r)});let n=s.querySelector(`.gooseshot-container`);if(!n)throw Error(`Failed to create preview element`);await xn(n,Cn(a,r))}finally{document.body.removeChild(s)}}async function En(e,t,n=`notebook`,r,i){if(!Array.isArray(e)||e.length===0)return;let a=dt(n,wn(i)),o=I(r),s=t||`选中内容`,c=C(e,{ensureFirstTitle:!1});await ye(c),await be(c,a),await en(c,a);let l=document.createElement(`div`);l.style.position=`fixed`,l.style.left=`-99999px`,l.style.top=`0`,l.style.zIndex=`-1`,document.body.appendChild(l);try{let{blocks:e,titleBlock:t}=q({blocks:c,pageTitle:s,showTitle:o.showTitle,mode:`selection`});l.innerHTML=B({title:s,blocksHtml:U(e,a),theme:a,watermarkConfig:o,titleInlineStyle:V(t,a)});let n=l.querySelector(`.gooseshot-container`);if(!n)throw Error(`Failed to create preview element`);await xn(n,Cn(s,a,`选中`))}finally{document.body.removeChild(l)}}function Dn(e){return Number.isFinite(e)&&e>=1e3}function On(e){return Number.isFinite(e)&&e>=1200}function kn(e){let t=e.page,n=Array.isArray(e.blocks)?e.blocks:[];if(e.mode===`selection`&&n.length>0)return{title:(t?_e(t):``)||S(t?.content)||`选中内容`,blocks:n};let r=C(t?.content,{ensureFirstTitle:!t?.localFilePath});return{title:(t?_e(t):``)||S(r)||`无标题`,blocks:r}}function An(e){let t=I(e.watermarkConfig),{blocks:n,titleBlock:r}=q({blocks:C(e.blocks,{ensureFirstTitle:!1}),pageTitle:e.title,showTitle:t.showTitle,mode:e.mode}),i=U(n,e.theme);return B({title:e.title,blocksHtml:i,theme:e.theme,watermarkConfig:t,preview:!0,titleInlineStyle:V(r,e.theme)})}function jn(e){let t=e&&typeof e==`object`?{...e}:{};return t.singleTabMode=!0,typeof t.randomIconOnCreate!=`boolean`&&(t.randomIconOnCreate=!0),delete t.showPinnedTitles,delete t.globalEditorFullWidth,delete t.tableEvenColumnWidth,t}function Z(e){let t=document.documentElement,n=e===`dark`||e===`system`&&window.matchMedia(`(prefers-color-scheme: dark)`).matches;n?t.classList.add(`dark`):t.classList.remove(`dark`),Mn(e,n);let r=$.getState();r&&(Q(r.codeStyle),w(r.accentColor),De())}async function Mn(e,t){}function Q(e){let t=document.documentElement,n=oe(e,t.classList.contains(`dark`));n?t.setAttribute(`data-code-theme`,n):t.removeAttribute(`data-code-theme`)}var Nn={applyTheme:Z,applyAccentColor:w,applyCodeStyle:Q},Pn=()=>Nn,$=r()(n(e=>({...pt(e),...gt(e,Pn),...vt(e),...wt(e),...Et(e),...Ot(e),...At(e),_hasHydrated:!1}),{name:`goose-note-settings`,version:3,migrate:e=>jn(e),storage:t(()=>i),skipHydration:!0,onRehydrateStorage:()=>e=>{let t=e?.theme||`system`,n=h(e?.accentColor),r=s(e?.codeStyle);Z(t),w(n),Q(r),e&&e.accentColor!==n&&$.setState({accentColor:n}),e&&e.codeStyle!==r&&$.setState({codeStyle:r});let i=lt(e?.imageExportThemeId);e&&e.imageExportThemeId!==i&&$.setState({imageExportThemeId:i}),e&&typeof e.defaultCodeBlockWrap!=`boolean`&&$.setState({defaultCodeBlockWrap:!1}),e&&typeof e.hideExpandArrows!=`boolean`&&$.setState({hideExpandArrows:!1}),e&&typeof e.randomIconOnCreate!=`boolean`&&$.setState({randomIconOnCreate:!0}),e&&e.singleTabMode!==!0&&$.setState({singleTabMode:!0});let o=a(e?.uiFontSize);e&&e.uiFontSize!==o&&$.setState({uiFontSize:o});let l=Math.min(g,Math.max(600,e?.utools?.windowHeight??800));e?.utools&&e.utools.windowHeight!==l&&$.setState({utools:{...e.utools,windowHeight:l}});let u=e?.utools?{globalSearchEnabled:!!e.utools.globalSearchEnabled,openSearchInUtools:typeof e.utools.openSearchInUtools==`boolean`?e.utools.openSearchInUtools:!0,useInternalImageViewer:typeof e.utools.useInternalImageViewer==`boolean`?e.utools.useInternalImageViewer:!1,windowHeight:l}:null;if(u&&JSON.stringify(e?.utools??null)!==JSON.stringify(u)&&$.setState({utools:u}),u)try{window.utools?.setExpendHeight?.(u.windowHeight)}catch(e){console.error(`Failed to apply window height on rehydrate`,e)}let d=fe(e?.ai);if(JSON.stringify(e?.ai??null)!==JSON.stringify(d)&&$.setState({ai:d}),e){typeof e.webdavUrl!=`string`&&$.setState({webdavUrl:`https://example.com/dav/`}),typeof e.webdavUsername!=`string`&&$.setState({webdavUsername:``}),typeof e.webdavPassword!=`string`&&$.setState({webdavPassword:``}),typeof e.webdavRemoteDir!=`string`&&$.setState({webdavRemoteDir:`goose-notes`});let t=e.webdavRetentionDays;(typeof t!=`number`||!Number.isFinite(t)||t<=0)&&$.setState({webdavRetentionDays:365}),typeof e.webdavAutoBackupEnabled!=`boolean`&&$.setState({webdavAutoBackupEnabled:!0}),typeof e.showRecentInSearch!=`boolean`&&$.setState({showRecentInSearch:!0});let n={autoOpenLastNote:typeof e.privacy?.autoOpenLastNote==`boolean`?e.privacy.autoOpenLastNote:!0,autoCloseInactiveTabs:typeof e.privacy?.autoCloseInactiveTabs==`boolean`?e.privacy.autoCloseInactiveTabs:!1,autoCloseInactiveTabsHours:c(e.privacy?.autoCloseInactiveTabsHours)};JSON.stringify(e.privacy??null)!==JSON.stringify(n)&&$.setState({privacy:n});let r=typeof e.closeTabShortcut==`string`?e.closeTabShortcut.trim():``,i=typeof e.searchPanelCloseShortcut==`string`?e.searchPanelCloseShortcut.trim():``;(e.closeTabShortcut!==r||e.searchPanelCloseShortcut!==i)&&$.setState({closeTabShortcut:r,searchPanelCloseShortcut:i});let a=_(e.searchProviders);JSON.stringify(e.searchProviders)!==JSON.stringify(a)&&$.setState({searchProviders:a});let o=f(e.customActions);JSON.stringify(e.customActions??[])!==JSON.stringify(o)&&$.setState({customActions:o});let s=e.appShortcuts??{},l={...L,...Object.fromEntries(Object.entries(s).filter(([e])=>!xt.has(e)))};JSON.stringify(e.appShortcuts)!==JSON.stringify(l)&&$.setState({appShortcuts:l});let u=e.desktop,d=me(u);JSON.stringify(e.desktop)!==JSON.stringify(d)&&$.setState({desktop:d});let p=I(e.imageExportWatermark);JSON.stringify(e.imageExportWatermark)!==JSON.stringify(p)&&$.setState({imageExportWatermark:p})}if(e){let t=typeof e.localFolderFileManager==`string`?e.localFolderFileManager.trim():``,n=typeof e.localFolderExternalEditor==`string`?e.localFolderExternalEditor.trim():``,r=typeof e.localFolderTerminal==`string`?e.localFolderTerminal.trim():``,i=Array.isArray(e.localFolderHiddenFolders)?e.localFolderHiddenFolders.filter(e=>typeof e==`string`&&e.length>0):[`assets`];(e.localFolderFileManager!==t||e.localFolderExternalEditor!==n||e.localFolderTerminal!==r||e.localFolderHiddenFolders!==i)&&$.setState({localFolderFileManager:t,localFolderExternalEditor:n,localFolderTerminal:r,localFolderHiddenFolders:i})}$.setState({_hasHydrated:!0})}}));if(typeof window<`u`){let e=window.matchMedia(`(prefers-color-scheme: dark)`),t=()=>{let{theme:e,codeStyle:t}=$.getState();e===`system`&&Z(`system`),Q(t)};typeof e.addEventListener==`function`?e.addEventListener(`change`,t):e.addListener(t);let n=()=>{let e=$.getState();Z(e.theme),w(e.accentColor),Q(e.codeStyle)};document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,n):n()}var Fn=e({AUTO_CLOSE_INACTIVE_TABS_HOURS_DEFAULT:()=>24,AUTO_CLOSE_INACTIVE_TABS_HOURS_MAX:()=>720,AUTO_CLOSE_INACTIVE_TABS_HOURS_MIN:()=>1,DEFAULT_ACCENT_COLOR:()=>ue,DEFAULT_CLOSE_TAB_SHORTCUT:()=>``,DEFAULT_QUICKNOTE_HOTKEY:()=>re,DEFAULT_SEARCH_HOTKEY:()=>ce,DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT:()=>``,DEFAULT_WAKE_HOTKEY:()=>ie,EDITOR_FONT_SIZE_DEFAULT:()=>16,EDITOR_FONT_SIZE_MAX:()=>24,EDITOR_FONT_SIZE_MIN:()=>12,UTOOLS_WINDOW_HEIGHT_DEFAULT:()=>800,UTOOLS_WINDOW_HEIGHT_MAX:()=>g,UTOOLS_WINDOW_HEIGHT_MIN:()=>600,useSettings:()=>$});export{Qe as C,Ve as E,T as S,qe as T,I as _,Dn as a,lt as b,En as c,Tt as d,L as f,ht as g,_t as h,kn as i,kt as l,St as m,$ as n,On as o,Ct as p,An as r,Tn as s,Fn as t,Dt as u,ft as v,Ze as w,dt as x,P as y};