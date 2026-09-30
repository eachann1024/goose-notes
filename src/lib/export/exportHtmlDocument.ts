import {
  EXPORT_HTML_HEAD_ASSETS,
  EXPORT_HTML_BODY_SCRIPTS,
} from "./blocknoteSerializer";
import { getExportHtmlCss } from "./exportHtmlCss";

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapExportEditorHtml(bodyHtml: string): string {
  return `<div class="workspace-editor-surface">
<div class="bn-container bn-mantine">
<div class="bn-root" data-color-scheme="light">
<div class="ProseMirror bn-editor bn-default-styles">
${bodyHtml}
</div>
</div>
</div>
</div>`;
}

const PAGE_CHROME_CSS = `
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
`;

export async function renderExportHtml(
  title: string,
  bodyHtml: string,
  includeBodyH1 = true,
): Promise<string> {
  const bodyHeading = includeBodyH1
    ? `<h1>${escapeHtmlText(title)}</h1>\n`
    : "";
  const editorCss = await getExportHtmlCss();
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtmlText(title)}</title>
${EXPORT_HTML_HEAD_ASSETS}
<style>
${editorCss}
${PAGE_CHROME_CSS}
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
${bodyHeading}${wrapExportEditorHtml(bodyHtml)}
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
</script>
${EXPORT_HTML_BODY_SCRIPTS}
</body>
</html>`;
}
