import { expect, test } from "playwright/test";
import {
  buildPagePrintHtml,
  canPrintToPdf,
  renderPrintHtml,
  toPrintMediaPlaceholders,
} from "../../src/lib/pdfExport/printPdf";
import type { BlockNoteContent } from "../../src/components/editor/utils/blocknote-content";
import { buildHtmlVisualExportPage } from "./htmlVisualExportFixture";
import { installExportDom } from "./installExportDom";

test.beforeEach(() => {
  installExportDom();
});

test("浏览器环境没有 electron 打印 API 时不走 printToPDF", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  try {
    expect(canPrintToPdf()).toBeFalsy();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("gooseFs.printHtmlToPdf 存在时才认为打印 API 可用", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      gooseFs: {
        printHtmlToPdf: async () => "AAAA",
      },
    },
  });
  try {
    expect(canPrintToPdf()).toBeTruthy();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("打印 HTML 用系统中文字体栈和 hex 颜色，不含 hsl(var)", async () => {
  const html = await renderPrintHtml("标题", "<p>正文</p>", true);
  expect(html).toContain("PingFang SC");
  expect(html).toContain("Microsoft YaHei");
  expect(html).toContain("Noto Sans SC");
  expect(html).toContain("<h1>标题</h1>");
  expect(html).toContain("<p>正文</p>");
  expect(html).toContain("#1f2329");
  expect(html).toContain("#ffffff");
  expect(html.includes("hsl(var(")).toBeFalsy();
  expect(html).toContain("__GOOSE_PRINT_READY__");
});

test("打印完整页 HTML 保留块背景且不含 hsl(var)", async () => {
  const page = buildHtmlVisualExportPage();
  page.content = page.content.filter((block) => block.type !== "image");
  const html = await buildPagePrintHtml(page, page.content);
  expect(html).toContain("第二周");
  expect(html).toContain('data-background-color="purple"');
  expect(html.includes("hsl(var(")).toBeFalsy();
});

test("视频/文件占位是图标+文件名，att-file 不进打印 HTML 块", () => {
  const blocks = toPrintMediaPlaceholders([
    {
      id: "v1",
      type: "video",
      props: { url: "att-file:abc", name: "演示.mp4", caption: "片头" },
      content: [],
      children: [],
    },
    {
      id: "f1",
      type: "file",
      props: { url: "https://example.com/a.zip", name: "资料.zip" },
      content: [],
      children: [],
    },
  ] as BlockNoteContent);

  expect(blocks[0].type).toBe("paragraph");
  const videoText = JSON.stringify(blocks[0]);
  expect(videoText).toContain("演示.mp4");
  expect(videoText).toContain("▶");
  expect(videoText).not.toContain("att-file:");

  expect(blocks[1].type).toBe("paragraph");
  const fileJson = JSON.stringify(blocks[1]);
  expect(fileJson).toContain("资料.zip");
  expect(fileJson).toContain("📎");
  expect(fileJson).toContain("https://example.com/a.zip");
});
