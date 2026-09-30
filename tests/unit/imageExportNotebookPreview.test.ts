import { expect, test } from "playwright/test";
import {
  buildNotebookCardTheme,
  CARD_THEMES,
  getCardTheme,
  normalizeCardThemeId,
  resolveCardTheme,
} from "../../src/lib/imageExport/themes";
import {
  IMAGE_EXPORT_LIVE_PREVIEW_MIN_WIDTH,
  IMAGE_EXPORT_OPTIONS_CORNER_MIN_WIDTH,
  buildImageExportPreviewHtml,
  getImageExportPreviewSource,
  shouldShowImageExportLivePreview,
  shouldShowImageExportOptionsCorner,
} from "../../src/lib/imageExport/livePreview";
import type { BlockNoteContent } from "../../src/components/editor/utils/blocknote-content";

test("宽屏才显示图片导出真实内容预览", () => {
  expect(IMAGE_EXPORT_LIVE_PREVIEW_MIN_WIDTH).toBe(1000);
  expect(shouldShowImageExportLivePreview(800)).toBe(false);
  expect(shouldShowImageExportLivePreview(999)).toBe(false);
  expect(shouldShowImageExportLivePreview(1000)).toBe(true);
  expect(shouldShowImageExportLivePreview(1200)).toBe(true);
  expect(shouldShowImageExportLivePreview(Number.NaN)).toBe(false);
});

test("1200 宽才把生成选项收到标题行", () => {
  expect(IMAGE_EXPORT_OPTIONS_CORNER_MIN_WIDTH).toBe(1200);
  expect(shouldShowImageExportOptionsCorner(800)).toBe(false);
  expect(shouldShowImageExportOptionsCorner(1199)).toBe(false);
  expect(shouldShowImageExportOptionsCorner(1200)).toBe(true);
  expect(shouldShowImageExportOptionsCorner(1250)).toBe(true);
  expect(shouldShowImageExportOptionsCorner(Number.NaN)).toBe(false);
});

test("notebook 是默认卡片主题，并按编辑器上下文生成所见即所得样式", () => {
  expect(CARD_THEMES[0].id).toBe("notebook");
  expect(normalizeCardThemeId("notebook")).toBe("notebook");
  const light = buildNotebookCardTheme({
    resolvedTheme: "light",
    editorFontSize: 16,
    fontFamily: "default",
  });
  expect(light.id).toBe("notebook");
  expect(light.name).toBe("笔记本");
  expect(light.nameEn).toBe("Notebook");
  expect(light.description).toBe("所见即所得");
  expect(light.mode).toBe("light");
  expect(light.background).toBe("#ffffff");
  expect(light.calloutBg).toBe("#f7f6f3");
  expect(light.bodyFontSize).toBe(16);
  expect(light.titleFontSize).toBe(26);

  const dark = resolveCardTheme("notebook", {
    resolvedTheme: "dark",
    editorFontSize: 18,
    fontFamily: "serif",
  });
  expect(dark.mode).toBe("dark");
  expect(dark.bodyFontSize).toBe(18);
  expect(dark.calloutBg).toBe("#2f2f2f");
  expect(dark.bodyFont).toContain("仓耳今楷");
});

test("getImageExportPreviewSource 用选区 blocks，空选区则走整页 content", () => {
  const pageContent: BlockNoteContent = [
    {
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "整页标题", styles: {} }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "整页正文", styles: {} }],
    },
  ];
  const selection: BlockNoteContent = [
    {
      type: "paragraph",
      content: [{ type: "text", text: "选中段落", styles: {} }],
    },
  ];
  const page = { content: pageContent };

  const selected = getImageExportPreviewSource({
    mode: "selection",
    page,
    blocks: selection,
  });
  expect(selected.blocks).toEqual(selection);
  expect(selected.title).toBe("整页标题");

  const wholePage = getImageExportPreviewSource({
    mode: "page",
    page,
    blocks: selection,
  });
  expect(wholePage.blocks).toHaveLength(2);
  expect(wholePage.title).toBe("整页标题");
  expect(JSON.stringify(wholePage.blocks)).toContain("整页正文");
  expect(JSON.stringify(wholePage.blocks)).not.toContain("选中段落");

  const emptySelection = getImageExportPreviewSource({
    mode: "selection",
    page,
    blocks: [],
  });
  expect(JSON.stringify(emptySelection.blocks)).toContain("整页正文");
  expect(emptySelection.title).toBe("整页标题");
});

test("buildImageExportPreviewHtml 含标题和正文", () => {
  const html = buildImageExportPreviewHtml({
    title: "预览标题",
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "预览正文", styles: {} }],
      },
    ],
    theme: getCardTheme("notebook"),
    mode: "page",
    watermarkConfig: { showTitle: true },
  });
  expect(html).toContain("预览标题");
  expect(html).toContain("预览正文");
  expect(html).toContain("html, body { background: transparent; }");
});

test("关闭底部信息栏后预览 HTML 不再保留水印占位", () => {
  const html = buildImageExportPreviewHtml({
    title: "预览标题",
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "预览正文", styles: {} }],
      },
    ],
    theme: getCardTheme("notebook"),
    mode: "page",
    watermarkConfig: { showTitle: true, showWatermark: false },
  });
  expect(html).not.toContain('class="gooseshot-watermark"');
  expect(html).toContain("html, body { background: transparent; }");
});
