const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./vendor-export~react-pdf.browser~blocknote-xl-pdf-exporter.js","./rolldown-runtime.js","./vendor-blocknote.js","./vendor-react.js","./vendor-prosemirror.js","../assets/vendor-blocknote.css","./vendor-export~index~export~index~webdavSync~react-pdf.browser~schema~blocknote-xl-pdf-exporter.js","./vendor-export~blocknote-xl-pdf-exporter.js","./useSettings.js","./vendor.js","./vendor-ui.js","./vendor-markdown.js","./vendor-katex~index~export~index~webdavSync.js","../assets/vendor.css","./sonner.js","./prepareExportBlocks.js","./file-system.js","./utils.js","./fs.js","./mermaid.js","./remoteImageResolver.js","./imageStorage.js","./utools.js","./imageProcessor.js","./utoolsDbStorage.js","./schema.js","./fileSave.js","./svgToPng.js","./shell.js"])))=>i.map(i=>d[i]);
import{s as e}from"./rolldown-runtime.js";import{f as t,o as n}from"./vendor-react.js";import{a as r}from"./sonner.js";import{Ft as i}from"./vendor-blocknote.js";import{i as a,n as o}from"./prepareExportBlocks.js";import{a as s}from"./mermaid.js";import{a as c,c as l,i as u,n as d,r as f}from"./exportHtmlDocument.js";import{r as p}from"./fontConfig.js";import{a as m,i as h,r as g}from"../assets/index.js";var _=e(t(),1),v=n(),y=.75,b=16,x=`#f7f6f3`,S=`#e9e9e7`,C=`#6366f1`;function w(e,t){let n=typeof e?.props?.name==`string`?e.props.name.trim():``,r=typeof e?.props?.caption==`string`?e.props.caption.trim():``;return n||r||t}function T(e){return/^https?:\/\//i.test(e)}async function E(e){let[{View:t,Text:n,Link:a,Image:o},{pdfDefaultSchemaMappings:s}]=await Promise.all([i(()=>import(`./vendor-export~react-pdf.browser~blocknote-xl-pdf-exporter.js`).then(e=>e.r),__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url),i(()=>import(`./vendor-export~blocknote-xl-pdf-exporter.js`).then(e=>e.t),__vite__mapDeps([7,1,2,3,4,5,0,6]),import.meta.url)]),c=s.blockMapping,l=b*y,u=e?.pageLocalFilePath??null,d=e?.resolveImageSrc??m,f=(e,r,i)=>{let a=r===`math`?`#5b8def`:`#7aa874`;return(0,v.jsxs)(t,{wrap:!1,style:{padding:12*y,backgroundColor:`#fafafa`,borderRadius:4,borderLeftWidth:3,borderLeftColor:a},children:[(0,v.jsx)(n,{style:{fontSize:l*.75,color:a,marginBottom:4},children:r===`math`?`ƒ Math`:`📊 Mermaid`}),(0,v.jsx)(n,{style:{fontSize:l},children:i||` `})]},r+e.id)},p=(e,r,i,a,s=`100%`)=>(0,v.jsxs)(t,{wrap:!1,style:{alignItems:`center`,paddingVertical:4*y},children:[(0,v.jsx)(o,{src:r,style:{width:s}}),a?(0,v.jsx)(n,{style:{fontSize:b*.8*y,color:`#6b7280`},children:a}):null]},i+e.id),_=(e,r,i,o,s)=>{let c=(0,v.jsxs)(t,{style:{flexDirection:`row`,gap:6*y,padding:6*y,backgroundColor:`#f5f5f5`,borderRadius:4},children:[(0,v.jsx)(n,{children:i}),(0,v.jsx)(n,{children:o})]});return(0,v.jsx)(t,{wrap:!1,children:s&&T(s)?(0,v.jsx)(a,{src:s,children:c}):c},r+e.id)},E=(e,i)=>{let a=r(e.props?.icon);return(0,v.jsxs)(t,{wrap:!1,style:{flexDirection:`row`,gap:8*y,paddingTop:8*y,paddingBottom:8*y,paddingLeft:12*y,paddingRight:12*y,borderLeftWidth:3,borderLeftColor:C,borderTopWidth:1,borderRightWidth:1,borderBottomWidth:1,borderTopColor:S,borderRightColor:S,borderBottomColor:S,backgroundColor:x,borderTopRightRadius:4,borderBottomRightRadius:4},children:[(0,v.jsx)(n,{style:{marginRight:4},children:a}),(0,v.jsx)(n,{style:{flex:1},children:i.transformInlineContent(Array.isArray(e.content)?e.content:[])})]},`callout`+e.id)},D=e=>_(e,`file`,`📎`,w(e,`未命名文件`),String(e.props?.url||``)),O=e=>_(e,`video`,`▶`,w(e,`视频`),String(e.props?.url||``)),k=e=>_(e,`audio`,`♪`,w(e,`音频`),String(e.props?.url||``)),A=(e,t,r,i,a)=>{if(typeof c.heading!=`function`)return(0,v.jsx)(n,{children:t.transformInlineContent(Array.isArray(e.content)?e.content:[])},`heading`+e.id);if(e.props?.isToggleable){let n=Array.isArray(e.content)?e.content:[];return c.heading({...e,content:[{type:`text`,text:`▾ `,styles:{}},...n]},t,r,i,a)}return c.heading(e,t,r,i,a)},j=async(r,i,a,o,s)=>{let u=await h(r,{renderMermaidPng:e?.renderMermaidPng,renderMathPng:e?.renderMathPng});if(u.kind===`png`)return p(r,u.src,u.language,void 0,u.language===`math`?`70%`:`100%`);if(u.kind===`empty`)return(0,v.jsx)(t,{wrap:!1},u.language+r.id);if(u.kind===`source-fallback`)return f(r,u.language,u.text);if(typeof c.codeBlock==`function`)return c.codeBlock(r,i,a,o,s);let d=Array.isArray(r.content)?r.content.map(e=>e.text||``).join(``):``;return(0,v.jsx)(t,{wrap:!1,style:{padding:12*y,border:`1px solid #ddd`,borderRadius:4},children:(0,v.jsx)(n,{style:{fontSize:l},children:d})},`codeBlock`+r.id)},M=async(e,r,i,a,o)=>{let s=String(e?.props?.url||e?.props?.src||``),l=e.props?.caption||``,f=null;if(s)try{f=await d(s,u)}catch(e){console.error(`[pdfExport] image resolve failed:`,s,e),f=null}return f&&g(f)&&typeof c.image==`function`?c.image({...e,props:{...e.props,url:f}},r,i,a,o):f&&g(f)?p(e,f,`image`,l||void 0):(0,v.jsx)(t,{wrap:!1,style:{padding:6*y},children:(0,v.jsx)(n,{children:l||`[图片]`})},`image`+e.id)};return{...c,callout:E,file:D,video:O,audio:k,heading:A,codeBlock:j,image:M}}var D=`"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;function O(){return typeof window>`u`?!1:typeof window.gooseFs?.printHtmlToPdf==`function`?!0:typeof window.utools?.createBrowserWindow==`function`}function k(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function A(e){return/^https?:\/\//i.test(e)}function j(e,t){let n=e.props??{},r=typeof n.name==`string`?n.name.trim():``,i=typeof n.caption==`string`?n.caption.trim():``;return r||i||t}function M(e,t,n){let r=e.props??{},i=String(r.url||r.src||``),a=j(e,n),o=typeof r.caption==`string`?r.caption.trim():``,s=o&&o!==a?`${t} ${a} ${o}`:`${t} ${a}`,c=A(i)?[{type:`link`,href:i,content:[{type:`text`,text:s,styles:{}}]}]:[{type:`text`,text:s,styles:{}}];return{...e,type:`paragraph`,props:{},content:c}}function N(e){return e.map(e=>{if(!e||typeof e!=`object`)return e;let t={...e};return t.type===`video`?Object.assign(t,M(t,`▶`,`视频`)):t.type===`file`?Object.assign(t,M(t,`📎`,`未命名文件`)):t.type===`audio`&&Object.assign(t,M(t,`♪`,`音频`)),Array.isArray(t.children)&&(t.children=N(t.children)),t})}async function P(e,t,n=!0){let r=n?`<h1>${k(e)}</h1>\n`:``,i=u(await f());return`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${k(e)}</title>
${l}
<style>
@page { size: A4; margin: 16mm; }
html, body {
  background: #ffffff;
  color: #1f2329;
}
body {
  font-family: ${D};
  max-width: 820px;
  margin: 0 auto;
  padding: 0;
  line-height: 1.65;
}
#export-content > h1 {
  font-size: 2em;
  line-height: 1.3;
  margin: 0 0 0.8em;
}
img, video { max-width: 100%; height: auto; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
${i}
</style>
</head>
<body>
<main id="export-content">
${r}${d(t)}
</main>
<script>
window.__GOOSE_PRINT_READY__ = false;
<\/script>
<script type="module">
const done = () => { window.__GOOSE_PRINT_READY__ = true; };
const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
try {
  await Promise.race([
    (async () => {
      const mermaid = (await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
      mermaid.initialize(${JSON.stringify({...s({mode:`light`,securityLevel:`loose`,useMaxWidth:!0}),startOnLoad:!0})});
      if (typeof mermaid.run === "function") {
        await mermaid.run();
      }
    })(),
    timeout,
  ]);
} catch (e) { console.warn("[printPdf] mermaid 加载失败:", e); }
done();
<\/script>
</body>
</html>`}async function F(e,t){return P(a(e)||`untitled`,await c(e,N(t)),!e.localFilePath)}function I(e){let t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);if(n.byteLength<80)throw Error(`printToPDF 返回空内容`);return new Blob([n],{type:`application/pdf`})}async function L(e){let t=window.utools;if(typeof t?.createBrowserWindow!=`function`)throw Error(`createBrowserWindow 不可用`);return new Promise((n,r)=>{let i=!1,a=null,o=(e,t)=>{if(!i){i=!0;try{a?.close?.()}catch{}e?r(e):t?n(t):r(Error(`printToPDF 失败`))}};try{let n=`data:text/html;charset=utf-8,${encodeURIComponent(e)}`;a=t.createBrowserWindow(n,{show:!1,width:820,height:1169,hasShadow:!1},()=>{(async()=>{try{let e=a?.webContents;if(typeof e?.printToPDF!=`function`)throw Error(`webContents.printToPDF 不可用`);if(typeof e.executeJavaScript==`function`){let t=Date.now();for(;Date.now()-t<8e3;){try{if(await e.executeJavaScript(`Boolean(window.__GOOSE_PRINT_READY__ === true)`))break}catch{}await new Promise(e=>setTimeout(e,150))}}else await new Promise(e=>setTimeout(e,800));let t=await e.printToPDF({printBackground:!0,preferCSSPageSize:!0}),n=t instanceof Uint8Array?t:new Uint8Array(t),r=``;for(let e=0;e<n.length;e++)r+=String.fromCharCode(n[e]);o(null,I(btoa(r)))}catch(e){o(e)}})()})}catch(e){o(e);return}setTimeout(()=>o(Error(`printToPDF 超时`)),2e4)})}async function R(e,t){if(!O())throw Error(`printToPDF 不可用`);let n=await F(e,t),r=window.gooseFs;if(typeof r?.printHtmlToPdf==`function`){let e=await r.printHtmlToPdf(n);if(!e)throw Error(`printToPDF 返回空内容`);return I(e)}return L(n)}async function z(){let{useSettings:e}=await i(async()=>{let{useSettings:e}=await import(`./useSettings.js`).then(e=>e.t);return{useSettings:e}},__vite__mapDeps([8,1,2,3,4,5,9,10,6,11,12,13,14,15,16,17,18,19,20,21,22,23,24]),import.meta.url);return e.getState().customFonts}async function B(e,t,n){let r=n??await z(),a=await p({fontFamily:e.fontFamily??`default`,customFonts:r});if(!a.ready)throw Error(`未能加载中文字体，无法生成 PDF`);let[{PDFExporter:o},s,{editorSchema:c},{pdfDefaultSchemaMappings:l}]=await Promise.all([i(()=>import(`./vendor-export~blocknote-xl-pdf-exporter.js`).then(e=>e.t),__vite__mapDeps([7,1,2,3,4,5,0,6]),import.meta.url),i(()=>import(`./vendor-export~react-pdf.browser~blocknote-xl-pdf-exporter.js`).then(e=>e.r),__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url),i(()=>import(`./schema.js`).then(e=>e.n),__vite__mapDeps([25,1,2,3,4,5,10,6,11,12,14,26,17,19,27,23,28,18]),import.meta.url),i(()=>import(`./vendor-export~blocknote-xl-pdf-exporter.js`).then(e=>e.t),__vite__mapDeps([7,1,2,3,4,5,0,6]),import.meta.url)]),u=new o(c,{blockMapping:await E({pageLocalFilePath:e.localFilePath??null}),inlineContentMapping:{...l.inlineContentMapping,pageMention:e=>{let t=typeof e?.props?.title==`string`&&e.props.title.trim()?e.props.title.trim():`未命名`,n=t.startsWith(`@`)?t:`@${t}`;return(0,_.createElement)(s.Text,{key:`pageMention-${n}`},n)}},styleMapping:l.styleMapping},{emojiSource:!1,resolveFileUrl:async e=>e});u.fontsRegistered=!0,u.styles.page={...u.styles.page,fontFamily:a.pageFontFamily};let d=await u.toReactPDFDocument(t),f=await s.pdf(d).toBlob();if(!f||f.size<80)throw Error(`react-pdf 生成了空 PDF`);return f}async function V(e,t){let n=await o(e),r=null,i;if(O())try{r=await R(e,n)}catch(e){i=e,console.warn(`[pdfExport] printToPDF 失败，降级 react-pdf:`,e)}if(!r)try{r=await B(e,n,t)}catch(e){i=e,console.error(`[pdfExport] react-pdf 导出失败:`,e)}if(!r)throw i instanceof Error?i:Error(`PDF 导出失败`);return r}export{V as renderPageToPdfBlob};