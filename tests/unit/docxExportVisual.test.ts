import { expect, test } from "playwright/test";
import JSZip from "jszip";
import { renderPageToDocxBlob } from "../../src/lib/docxExport";
import {
  HTML_VISUAL_CHINESE_BODY,
  buildHtmlVisualExportPage,
} from "./htmlVisualExportFixture";
import { installExportDom } from "./installExportDom";

test.beforeEach(() => {
  installExportDom();
});

test("Word 导出保留预览色带、待办勾选和内联图", async () => {
  const blob = await renderPageToDocxBlob(buildHtmlVisualExportPage());
  expect(blob.size).toBeGreaterThan(80);

  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  expect(documentXml).toBeTruthy();
  const xml = documentXml ?? "";

  expect(xml).toContain("第二周");
  expect(xml).toContain(HTML_VISUAL_CHINESE_BODY);
  expect(xml.toLowerCase()).toContain("eae4f2");
  const vAlignCenter = xml.match(/w:vAlign[^>]*w:val="center"/g) ?? [];
  expect(vAlignCenter.length).toBeGreaterThanOrEqual(5);
  expect(xml).toContain("☑");
  expect(xml).toContain("☐");
  expect(xml).not.toContain("☒");
  expect(xml).toMatch(/a:blip|w:drawing|pic:pic/);

  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  expect(stylesXml).toBeTruthy();
  expect(stylesXml).toContain("Heading2");
});
