import { expect, test } from "playwright/test";
import { applyExportMediaSrc } from "../../src/lib/export/blocksToEditorHtml";
import { buildExportHtmlBody } from "../../src/lib/export/pageMarkdown";
import { renderExportHtml } from "../../src/lib/export/exportHtmlDocument";
import {
  HTML_VISUAL_CHINESE_BODY,
  HTML_VISUAL_PIXEL_PNG,
  buildHtmlVisualExportPage,
} from "./htmlVisualExportFixture";
import { installExportDom } from "./installExportDom";
import type { BlockNoteContent } from "../../src/components/editor/utils/blocknote-content";

test.beforeEach(() => {
  installExportDom();
});

/** Playwright 会把本仓 TSX 编成 __pw_type，React 自定义块无法在 Node 里 createRoot。 */
function coreVisualContent() {
  const page = buildHtmlVisualExportPage();
  return {
    ...page,
    content: page.content.filter((block) => block.type !== "image") as BlockNoteContent,
  };
}

async function renderVisualExportHtml(): Promise<string> {
  const page = coreVisualContent();
  const bodyHtml = await buildExportHtmlBody(page, page.content);
  const imageHtml = applyExportMediaSrc(
    `<img data-url="${HTML_VISUAL_PIXEL_PNG}" alt="像素" />`,
  );
  return await renderExportHtml("导出风格验收", `${bodyHtml}${imageHtml}`, true);
}

function hasChecklistStructure(html: string): boolean {
  if (html.includes('data-content-type="checkListItem"')) return true;
  return /<input\b[^>]*\btype=["']checkbox["']/i.test(html);
}

function hasBlockBackgroundRibbon(html: string): boolean {
  if (/calc\(\s*100%\s*\+\s*12px\s*\)/.test(html)) return true;
  return html.includes(".bn-block-content[data-background-color]");
}

test("HTML 导出保留编辑器块背景、待办和内联图，不走 Markdown 管道", async () => {
  const html = await renderVisualExportHtml();

  expect(html).toContain("第二周");
  expect(html).toContain(HTML_VISUAL_CHINESE_BODY);
  expect(html).toContain('data-background-color="purple"');
  expect(html).toContain("#eae4f2");
  expect(html).toContain("--goose-editor-highlight-purple-bg");
  expect(html).toContain("--bn-colors-highlights-purple-background");
  expect(
    hasBlockBackgroundRibbon(html),
    "完整 HTML 必须带色带几何（calc(100% + 12px) 或 block-background 规则）",
  ).toBeTruthy();
  expect(
    hasChecklistStructure(html),
    "待办必须是 checkbox 或 BlockNote checkListItem，不能只剩圆点 ul",
  ).toBeTruthy();
  expect(html.includes("<ul")).toBeFalsy();
  expect(html).toMatch(/<img\b[^>]*\bsrc=["']data:image\//i);
  expect(html).toContain('[data-callout="true"]');
  expect(html).toContain("align-items: center");
  expect(html).toMatch(
    /\[data-callout="true"\][\s\S]*button[\s\S]*border:\s*0/,
  );
  expect(html).toContain("font-size: var(--editor-module-sm-font-size)");
  expect(html).toContain("stroke-width: 1.75");
});

test("官方 full HTML 只有 data-url 时会补到 img src", () => {
  const html = applyExportMediaSrc(
    `<img data-url="${HTML_VISUAL_PIXEL_PNG}" />`,
  );
  expect(html).toContain(`src="${HTML_VISUAL_PIXEL_PNG}"`);
});

test("导出 HTML 在浏览器里标题背景不是 transparent", async ({ page }) => {
  const html = await renderVisualExportHtml();
  await page.setContent(html);

  const background = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h1, h2, h3, h4")].find(
      (el) => el.textContent?.includes("第二周"),
    );
    const painted =
      heading?.closest("[data-background-color]") ??
      document.querySelector('[data-background-color="purple"]') ??
      heading;
    if (!painted) throw new Error("找不到带背景的「第二周」标题");
    return getComputedStyle(painted).backgroundColor;
  });

  expect(background).not.toBe("transparent");
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
});
