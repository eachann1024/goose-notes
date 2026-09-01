const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./exportHtmlCss.vite.js","./vendor-blocknote.js","./rolldown-runtime.js","./vendor-react.js","./vendor-prosemirror.js","../assets/vendor-blocknote.css"])))=>i.map(i=>d[i]);
import{a as e}from"./sonner.js";import{I as t,Pt as n}from"./vendor-blocknote.js";import{i as r,x as i}from"./prepareExportBlocks.js";import{B as a,V as o,z as s}from"./vendor.js";import{a as c}from"./mermaid.js";import{a as l,r as u}from"./blockPropsMarker.js";import{t as d}from"./schema.js";import{b as ee,c as te,f as ne,h as f,l as p,m,p as h,y as g}from"./vendor-markdown.js";var _=`goose-note=`;function v(e){return typeof e==`string`?e.replace(/[\r\n]+/g,` `).trim():``}function y(e,t){let n=[],r=typeof e==`string`?e.trim():``;r&&n.push(r);let i=v(t?.summary),a=t?.collapsed===!0,o={};return i&&(o.summary=i),a&&(o.collapsed=!0),Object.keys(o).length>0&&n.push(`${_}${encodeURIComponent(JSON.stringify(o))}`),n.join(` `)}function b(e,t){let n=t.underline===!0,r=u(t.textColor),i=u(t.backgroundColor),a=r&&r!=="default",o=i&&i!=="default",s=o&&i===`yellow`&&!a;if(t.bold&&(e=`**${e}**`),t.italic&&(e=`*${e}*`),t.strike&&(e=`~~${e}~~`),t.code&&(e=`\`${e}\``),s)e=`==${e}==`;else if(a||o){let t=[];a&&t.push(`color:${r}`),o&&t.push(`background-color:${i}`),e=`<span style="${S(t.join(`; `))}">${e}</span>`}return n?`<u>${e}</u>`:e}function re(e){return typeof e==`string`?e:Array.isArray(e)?e.map(e=>typeof e==`string`?e:b(e?.text||``,e?.styles||{})).join(``):``}function x(e){return e==null?``:typeof e==`string`?e:typeof e==`object`&&!Array.isArray(e)&&Array.isArray(e.content)?x(e.content):Array.isArray(e)?e.map(e=>typeof e==`string`?e:e==null?``:e.type===`paragraph`&&Array.isArray(e.content)?x(e.content):e.type===`link`?`[${re(e.content)}](${e.href||``})`:b(e.text||``,e.styles||{})).join(``):``}function ie(e){return e.replace(/\|/g,`\\|`).replace(/\n/g,` `)}function S(e){return e.replace(/&/g,`&amp;`).replace(/"/g,`&quot;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}var C=new Set([`bulletListItem`,`numberedListItem`,`checkListItem`]),w=new Set([`toggleListItem`,`details`,`bulletList`,`orderedList`,`taskList`]);function T(e,t,n){let r=x(e.content),i,a;e.type===`checkListItem`?(i=`- [${e.props?.checked?`x`:` `}] `,a=2):e.type===`numberedListItem`?(i=`${n??1}. `,a=i.length):(i=`- `,a=2);let o=l(e,`${t}${i}${r}`);if(Array.isArray(e.children)&&e.children.length>0){let n=E(e.children,t+` `.repeat(a));n&&(o+=`
`+n)}return o}function E(e,t){let n=[],r=0;for(;r<e.length;){let i=e[r];if(!i||typeof i!=`object`){r++;continue}if(C.has(i.type)){let i=[],a=null;for(;r<e.length&&C.has(e[r]?.type);){let n=e[r];if(n.type===`numberedListItem`){let e=n.props?.start;a=typeof e==`number`?e:a==null?1:a+1}else a=null;i.push(T(n,t,a)),r++}n.push(i.join(`
`));continue}let a=k(i,t);a!==``&&n.push(a),r++}return n.join(`

`)}function D(e){return x(Array.isArray(e?.content)&&e.content[0]?.type===`paragraph`?e.content[0].content:e?.content)}function O(e,t){if(!e||typeof e!=`object`)return``;let n=t+`  `,r=Array.isArray(e.children)?e.children.map(e=>O(e,n)).filter(Boolean):[],i;return i=e.type===`taskItem`?`${t}- [${e?.attrs?.checked===!0||e?.props?.checked===!0?`x`:` `}] ${D(e)}`:e.type===`listItem`?e.attrs?.start==null?`${t}- ${D(e)}`:`${t}${e.attrs.start}. ${D(e)}`:`${t}${x(e.content)}`,r.length?i+`
`+r.join(`
`):i}function k(t,n=``){let r=x(t.content),i;switch(t.type){case`heading`:i=`${`#`.repeat(t.props?.level||t.attrs?.level||1)} ${r}`;break;case`quote`:i=r.split(`
`).map(e=>`> ${e}`).join(`
`);break;case`codeBlock`:{let e=t.props??t.attrs??{},n=(e.language||``).trim();if(n===`yaml-frontmatter`){let e=r.trim();i=e?`---\n${e}\n---`:`---
---`}else i=n===`math`||n===`latex`?`$$\n${r}\n$$`:`\`\`\`${y(n,e)}\n${r}\n\`\`\``;break}case`image`:{let e=t.props??t.attrs??{},n=e.url||e.src||``,r=e.caption||e.alt||``,a=[],o=e.previewWidth??e.width;o!=null&&Number.isFinite(Number(o))&&a.push(`width=${o}`);let s=e.textAlignment;typeof s==`string`&&s&&s!==`left`&&a.push(`align=${s}`),i=`![${r}](${n})${a.length?`{${a.join(` `)}}`:``}`;break}case`imageResize`:{let e=t.attrs??t.props??{},n=e.src||e.url||``,r=e.alt||e.caption||``,a=[];e.width!=null&&Number.isFinite(Number(e.width))&&a.push(`width=${e.width}`),e.height!=null&&Number.isFinite(Number(e.height))&&a.push(`height=${e.height}`);let o=e.containerStyle??``,s;o.includes(`margin: 0 auto 0 0`)?s=`left`:o.includes(`margin: 0 auto;`)?s=`center`:o.includes(`margin: 0 0 0 auto`)&&(s=`right`),s&&a.push(`align=${s}`),i=`![${r}](${n})${a.length?`{${a.join(` `)}}`:``}`;break}case`table`:{let e,n=t.content;if(n&&typeof n==`object`&&!Array.isArray(n)&&Array.isArray(n.rows))e=n.rows.map(e=>Array.isArray(e?.cells)?e.cells:[]);else if(Array.isArray(n))e=n.map(e=>Array.isArray(e?.content)?e.content:[]);else return``;if(!e.length)return``;let r=Math.max(...e.map(e=>e.length),1),a=e=>{let t=e.map(e=>ie(x(e)));for(;t.length<r;)t.push(``);return t},o=a(e[0]),s=Array(r).fill(`---`),c=e.slice(1).map(a);i=[`| ${o.join(` | `)} |`,`| ${s.join(` | `)} |`,...c.map(e=>`| ${e.join(` | `)} |`)].join(`
`);break}case`callout`:{let n=t.props?.icon??t.attrs?.emoji;i=r.split(`
`).map((t,r)=>r===0?`> [!INFO] ${e(n)} ${t}`:`> ${t}`).join(`
`);break}case`divider`:case`horizontalRule`:i=`---`;break;case`file`:{let e=t.props??t.attrs??{};i=`[📎 ${e.name||`文件`}](${e.url||``})`;break}case`video`:{let e=t.props??t.attrs??{};i=`<video src="${S(e.url||e.src||``)}" controls preload="metadata"></video>`;break}case`audio`:{let e=t.props??t.attrs??{};i=`[📎 ${e.name||`音频`}](${e.url||``})`;break}case`toggleListItem`:{let e=Array.isArray(t.children)?t.children:[],n=e.length?E(e,``):``;i=n?`<details>\n<summary>${r}</summary>\n\n${n}\n\n</details>`:`<details>\n<summary>${r}</summary>\n\n</details>`;break}case`details`:{let e=Array.isArray(t.content)?t.content:[],n=e.find(e=>e?.type===`detailsSummary`),r=e.find(e=>e?.type===`detailsContent`);i=`<details>\n<summary>${n?x(n.content):`详情`}</summary>\n\n${E(Array.isArray(r?.content)?r.content:[],``)}\n\n</details>`;break}case`detailsSummary`:case`detailsContent`:i=r;break;case`bulletList`:case`taskList`:i=(Array.isArray(t.content)?t.content:[]).map(e=>O(e,n)).filter(Boolean).join(`
`);break;case`orderedList`:{let e=Array.isArray(t.content)?t.content:[],r=t.attrs?.start??t.props?.start??1;i=e.map((e,t)=>{let i=`${n}${e?.attrs?.start??r+t}. ${D(e)}`;if(Array.isArray(e?.children)&&e.children.length>0){let t=e.children.map(e=>O(e,n+`  `)).filter(Boolean).join(`
`);return t?`${i}\n${t}`:i}return i}).join(`
`);break}case`blockquote`:i=(Array.isArray(t.content)?t.content:[]).map(e=>x(e?.content??e)).join(`
`).split(`
`).map(e=>`> ${e}`).join(`
`);break;default:i=r}if(i=l(t,i),!w.has(t.type)&&Array.isArray(t.children)&&t.children.length>0){let e=E(t.children,n);e&&(i+=(i?`

`:``)+e)}return i}function A(e,t=!1){if(i(e)){let n=e;return t&&n[0]?.type===`heading`&&(n=n.slice(1)),E(n,``)}return``}function j(){return e=>{let t=e=>{if(e){if(e.type===`element`&&e.tagName===`pre`&&Array.isArray(e.children)){let t=e.children.find(e=>e&&e.type===`element`&&e.tagName===`code`),n=t?.properties?.className;if(Array.isArray(n)&&n.some(e=>e===`language-mermaid`)){let n=(t.children||[]).map(e=>typeof e?.value==`string`?e.value:``).join(``);e.tagName=`pre`,e.properties={className:[`mermaid`]},e.children=[{type:`text`,value:n}];return}}Array.isArray(e.children)&&e.children.forEach(t)}};t(e)}}var M=ee().use(g).use(f).use(m).use(h,{allowDangerousHtml:!0}).use(ne).use(p,{detect:!0,ignoreMissing:!0}).use(j).use(te,{allowDangerousHtml:!0});async function N(e){return A(e)}async function P(e){let t=A(e),n=await M.process(t);return String(n)}var F=`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css">`,I=`
<script type="module">
  try {
    const mermaid = (await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
    mermaid.initialize(${JSON.stringify({...c({mode:`light`,securityLevel:`loose`,useMaxWidth:!0}),startOnLoad:!0})});
  } catch (e) { console.warn("[export] mermaid 加载失败:", e); }
<\/script>
`.trim(),L=new Set([`img`,`video`,`source`,`audio`]);function R(e,t){return e.match(RegExp(`\\b${t}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,`i`))?.[2]}function z(e,t,n){return RegExp(`\\b${t}\\s*=`,`i`).test(e)?e.replace(RegExp(`\\b${t}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,`i`),`${t}="${n}"`):`${e} ${t}="${n}"`}function ae(e){return e.replace(/<([a-zA-Z][\w:-]*)([^>]*?)>/g,(e,t,n)=>{let r=String(t).toLowerCase(),i=R(n,`data-url`);return i?L.has(r)?R(n,`src`)?e:`<${t}${z(n,`src`,i)}>`:r===`a`?R(n,`href`)?e:`<${t}${z(n,`href`,i)}>`:e:e})}function B(e){return Array.isArray(e)&&e.length>0?e:[{type:`paragraph`,content:[]}]}function V(e){let n=B(e);return ae(t.create({schema:d,initialContent:n}).blocksToFullHTML(n))}function H(e){return!e||typeof e!=`object`||!(`type`in e)||e.type!==`heading`||!(`props`in e)||!e.props||typeof e.props!=`object`?!1:((`level`in e.props?e.props.level:void 0)??1)===1}function U(e){return e.length>0&&H(e[0])?e.slice(1):e}async function W(e,t,n={}){return e.localFilePath?N(t):n.includeTitleHeading??!0?`# ${r(e)}\n\n${await N(U(t))}`:N(U(t))}async function G(e,t){return V(e.localFilePath?t:U(t))}a();function K(e){let t=e.replace(/[/\\][^/\\]+$/,``);return o(e,`utf8`).replace(/@import\s+"([^"]+)";\s*/g,(e,n)=>`${o(n.startsWith(`./`)?`${t}/${n.slice(2)}`:`${t}/${n}`,`utf8`)}\n`)}var q=`
:root {
  color-scheme: light;
  --editor-font-size: 16px;
  --editor-scale: 1;
  --editor-module-sm-font-size: 14px;
  --font-default: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Helvetica Neue", Arial, "HarmonyOS Sans SC", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  --font-mono: ui-monospace, "DM Mono", Menlo, Consolas, "HarmonyOS Sans SC",
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC",
    monospace;
  --foreground: 0 0% 12%;
  --muted: 60 2% 96%;
  --muted-foreground: 0 0% 43%;
  --border: 0 0% 86%;
  --goose-interactive-selected: #e0e7ff;
  --goose-interactive-selected-fg: #4f46e5;
  --goose-callout-accent: #6366f1;
  --goose-callout-bg: #f7f6f3;
  --goose-callout-border: #e9e9e7;
  --goose-block-subtle-bg: #f3f2f1;
  --goose-block-subtle-border: #e8e7e5;
  --goose-inline-code-bg: #eef2ff;
  --goose-inline-code-fg: #4f46e5;
  --goose-editor-highlight-gray-text: #9b9a97;
  --goose-editor-highlight-gray-bg: #ebeced;
  --goose-editor-highlight-brown-text: #64473a;
  --goose-editor-highlight-brown-bg: #e9e5e3;
  --goose-editor-highlight-red-text: #e03e3e;
  --goose-editor-highlight-red-bg: #fbe4e4;
  --goose-editor-highlight-orange-text: #d9730d;
  --goose-editor-highlight-orange-bg: #f6e9d9;
  --goose-editor-highlight-yellow-text: #dfab01;
  --goose-editor-highlight-yellow-bg: #fbf3db;
  --goose-editor-highlight-green-text: #4d6461;
  --goose-editor-highlight-green-bg: #ddedea;
  --goose-editor-highlight-blue-text: #0b6e99;
  --goose-editor-highlight-blue-bg: #ddebf1;
  --goose-editor-highlight-purple-text: #6940a5;
  --goose-editor-highlight-purple-bg: #eae4f2;
  --goose-editor-highlight-pink-text: #ad1a72;
  --goose-editor-highlight-pink-bg: #f4dfeb;
}
.bn-root {
  --bn-colors-highlights-gray-text: var(--goose-editor-highlight-gray-text);
  --bn-colors-highlights-gray-background: var(--goose-editor-highlight-gray-bg);
  --bn-colors-highlights-brown-text: var(--goose-editor-highlight-brown-text);
  --bn-colors-highlights-brown-background: var(--goose-editor-highlight-brown-bg);
  --bn-colors-highlights-red-text: var(--goose-editor-highlight-red-text);
  --bn-colors-highlights-red-background: var(--goose-editor-highlight-red-bg);
  --bn-colors-highlights-orange-text: var(--goose-editor-highlight-orange-text);
  --bn-colors-highlights-orange-background: var(--goose-editor-highlight-orange-bg);
  --bn-colors-highlights-yellow-text: var(--goose-editor-highlight-yellow-text);
  --bn-colors-highlights-yellow-background: var(--goose-editor-highlight-yellow-bg);
  --bn-colors-highlights-green-text: var(--goose-editor-highlight-green-text);
  --bn-colors-highlights-green-background: var(--goose-editor-highlight-green-bg);
  --bn-colors-highlights-blue-text: var(--goose-editor-highlight-blue-text);
  --bn-colors-highlights-blue-background: var(--goose-editor-highlight-blue-bg);
  --bn-colors-highlights-purple-text: var(--goose-editor-highlight-purple-text);
  --bn-colors-highlights-purple-background: var(--goose-editor-highlight-purple-bg);
  --bn-colors-highlights-pink-text: var(--goose-editor-highlight-pink-text);
  --bn-colors-highlights-pink-background: var(--goose-editor-highlight-pink-bg);
}
.bn-default-styles,
.bn-editor {
  font-family: var(--font-default);
  font-size: var(--editor-font-size);
}
`,J=`
[data-callout="true"],
.workspace-editor-surface [data-callout="true"] {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 1px solid var(--goose-callout-border);
  background: var(--goose-callout-bg);
  padding: 0.5rem 0.75rem;
  font-size: var(--editor-module-sm-font-size);
  line-height: 1.5;
}
[data-callout="true"] .callout-content {
  min-width: 0;
  flex: 1;
}
[data-callout="true"] button,
[data-callout="true"] button[data-callout-icon-trigger],
[data-callout="true"] .callout-icon-slot {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  outline: 0;
  box-shadow: none;
  background: transparent;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  min-width: 1.5em;
  min-height: 1.5em;
  line-height: 0;
  color: inherit;
  flex-shrink: 0;
}
[data-callout="true"] svg,
[data-callout="true"] .lucide {
  display: block;
  width: 1em;
  height: 1em;
  overflow: visible;
  stroke-width: 1.75;
}
.goose-file-block-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  background-color: #f3f2f1;
  border: 1px solid #e8e7e5;
  width: 100%;
  box-sizing: border-box;
}
.goose-file-block-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  color: #1f2329;
}
.goose-video-block-shell {
  display: block;
  max-width: 100%;
}
.goose-video-player__video,
.goose-video-block-shell video,
.bn-visual-media {
  display: block;
  max-width: 100%;
  height: auto;
}
.workspace-editor-surface
  .bn-block-content[data-content-type="checkListItem"]
  > div
  > input {
  border: 0.09em solid #57606a;
}
.workspace-editor-surface
  .bn-block-content[data-content-type="checkListItem"][data-checked="true"]
  .bn-inline-content {
  color: #57606a;
}
`,Y=[`node_modules/@blocknote/react/dist/style.css`,`src/pages/workspace/styles/block-background.css`,`src/pages/workspace/styles/editor-base.css`];function oe(){try{return s(Y[0])?Y.map(e=>e.endsWith(`editor-base.css`)?K(e):o(e,`utf8`)).join(`
`):null}catch{return null}}function se(e){return[q,e,J].join(`
`)}async function ce(){let e=Object.assign({"./exportHtmlCss.vite.ts":()=>n(()=>import(`./exportHtmlCss.vite.js`),__vite__mapDeps([0,1,2,3,4,5]),import.meta.url)})[`./exportHtmlCss.vite.ts`];if(!e)throw Error(`导出样式未打包`);return(await e()).EXPORT_VENDOR_CSS}async function X(){return se(oe()||await ce())}function Z(e){return e.replace(/[^{};]+:[^;{}]*hsl\(\s*var\([^;{}]*;/g,``).replace(/hsl\(\s*var\([^)]*\)\s*\/\s*[^)]+\)/g,`transparent`).replace(/hsl\(\s*var\([^)]*\)\)/g,`#1f2329`)}function Q(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function $(e){return`<div class="workspace-editor-surface">
<div class="bn-container bn-mantine">
<div class="bn-root" data-color-scheme="light">
<div class="ProseMirror bn-editor bn-default-styles">
${e}
</div>
</div>
</div>
</div>`}var le=`
html { color-scheme: light; }
body {
  font-family: var(--font-default);
  max-width: 820px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.65;
  color: #1f2329;
  background: #ffffff;
}
#export-content > h1 {
  font-size: 2em;
  line-height: 1.3;
  margin: 0 0 0.8em;
  scroll-margin-top: 1.5rem;
}
img, video { max-width: 100%; height: auto; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
.export-toc { position: fixed; z-index: 1; top: 1rem; left: 1rem; width: min(17rem, calc(100vw - 2rem)); max-height: calc(100vh - 2rem); overflow: auto; box-sizing: border-box; padding: 0.45rem; border: 1px solid #d8dee4; border-radius: 8px; background: #ffffff; box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12); font-size: 0.875rem; }
.export-toc__header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.export-toc__title { margin: 0; color: #1f2329; font-size: 0.875rem; font-weight: 600; }
.export-toc__toggle { appearance: none; border: 0; border-radius: 5px; padding: 0.25rem 0.45rem; background: #f2f3f5; color: #1f2329; cursor: pointer; font: inherit; line-height: 1.25; }
.export-toc__toggle:hover { background: #e8eaed; }
.export-toc__list { margin: 0.4rem 0 0; padding: 0; list-style: none; }
.export-toc__item + .export-toc__item { margin-top: 0.15rem; }
.export-toc__link { display: block; overflow: hidden; padding: 0.18rem 0.35rem; border-radius: 4px; color: #57606a; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.export-toc__link:hover { background: #f2f3f5; color: #1f2329; }
.export-toc__item--h2 { padding-left: 0.75rem; }
.export-toc__item--h3 { padding-left: 1.5rem; }
.export-toc__item--h4 { padding-left: 2.25rem; }
.export-toc.is-collapsed { width: auto; overflow: visible; }
.export-toc.is-collapsed .export-toc__title, .export-toc.is-collapsed .export-toc__list { display: none; }
@media (max-width: 1100px) { .export-toc { position: static; width: 100%; max-height: none; margin: 0 0 1.5rem; } .export-toc.is-collapsed { width: fit-content; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
`;async function ue(e,t,n=!0){let r=n?`<h1>${Q(e)}</h1>\n`:``,i=await X();return`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${Q(e)}</title>
${F}
<style>
${i}
${le}
</style>
</head>
<body>
<nav class="export-toc" aria-label="文档目录">
  <div class="export-toc__header">
    <p class="export-toc__title">目录</p>
    <button class="export-toc__toggle" type="button" aria-expanded="true">收起</button>
  </div>
  <ol class="export-toc__list"></ol>
</nav>
<main id="export-content">
${r}${$(t)}
</main>
<script>
(() => {
  const toc = document.querySelector('.export-toc');
  const list = toc?.querySelector('.export-toc__list');
  const toggle = toc?.querySelector('.export-toc__toggle');
  const headings = document.querySelectorAll('#export-content h1, #export-content h2, #export-content h3, #export-content h4');
  const usedIds = new Set();
  const makeId = (text) => {
    const base = text.trim().toLowerCase().replace(/[^\\w\\u4e00-\\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    let id = base;
    let suffix = 2;
    while (usedIds.has(id) || document.getElementById(id)) id = base + '-' + suffix++;
    return id;
  };
  headings.forEach((heading) => {
    const text = heading.textContent?.trim();
    if (!text || !list) return;
    const existingId = heading.id;
    const id = existingId && !usedIds.has(existingId) ? existingId : makeId(text);
    heading.id = id;
    usedIds.add(id);
    const item = document.createElement('li');
    item.className = 'export-toc__item export-toc__item--' + heading.tagName.toLowerCase();
    const link = document.createElement('a');
    link.className = 'export-toc__link';
    link.href = '#' + encodeURIComponent(id);
    link.textContent = text;
    item.append(link);
    list.append(item);
  });
  if (!list?.children.length) toc?.remove();
  toggle?.addEventListener('click', () => {
    const collapsed = toc?.classList.toggle('is-collapsed') ?? false;
    toggle.textContent = collapsed ? '目录' : '收起';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
})();
<\/script>
${I}
</body>
</html>`}export{G as a,P as c,Z as i,N as l,$ as n,W as o,X as r,F as s,ue as t,A as u};