import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { installExportDom } from "./installExportDom";
import {
  contentBlockFromEventTarget,
  extendToVisualLineEnd,
  findPosOnVisualLine,
  isClickOnVisualLine,
  isClickPastTextRight,
  isInteractiveCaretClickTarget,
  isTextBlockContent,
  pickOwningBlockIndex,
  pickTrailingBlankContentEl,
  resolveBlockEmptyClickPos,
  resolveLineEndIfClickPastText,
  tableCellInlineFromEventTarget,
  type CaretCoords,
} from "../../src/components/editor/extensions/trailingBlankClickExtension";

/** 一行 0–5，第二行 6–10。Y 以 20px 分行，每格宽 10px。 */
function twoLineCoords(pos: number): CaretCoords {
  if (pos <= 5) {
    return { top: 0, bottom: 20, left: pos * 10, right: pos * 10 + 8 };
  }
  const col = pos - 6;
  return { top: 20, bottom: 40, left: col * 10, right: col * 10 + 8 };
}

test("点在末字右侧才算行尾空白，点在字上或左侧不算", () => {
  expect(isClickPastTextRight(60, 50)).toBe(true);
  expect(isClickPastTextRight(52, 50)).toBe(false);
  expect(isClickPastTextRight(50, 50)).toBe(false);
  expect(isClickPastTextRight(10, 50)).toBe(false);
});

test("点击 Y 落在视觉行带内才算同一行", () => {
  expect(isClickOnVisualLine(10, 0, 20)).toBe(true);
  expect(isClickOnVisualLine(-2, 0, 20)).toBe(true);
  expect(isClickOnVisualLine(22, 0, 20)).toBe(true);
  expect(isClickOnVisualLine(30, 0, 20)).toBe(false);
});

test("沿视觉行走到行尾，遇到折行停止", () => {
  expect(extendToVisualLineEnd(twoLineCoords, 2, 10)).toBe(5);
  expect(extendToVisualLineEnd(twoLineCoords, 7, 10)).toBe(10);
  expect(extendToVisualLineEnd(twoLineCoords, 0, 5)).toBe(5);
});

test("按点击 Y 落到对应视觉行", () => {
  expect(findPosOnVisualLine(twoLineCoords, 0, 10, 10)).toBeGreaterThanOrEqual(0);
  expect(findPosOnVisualLine(twoLineCoords, 0, 10, 10)).toBeLessThanOrEqual(5);
  expect(findPosOnVisualLine(twoLineCoords, 0, 10, 30)).toBeGreaterThanOrEqual(6);
  expect(findPosOnVisualLine(twoLineCoords, 0, 10, 100)).toBeNull();
});

test("点第一行行尾空白落到第一行末，不跳到第二行", () => {
  expect(
    resolveLineEndIfClickPastText({
      clientX: 120,
      clientY: 10,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBe(5);
});

test("点第二行行尾空白落到第二行末", () => {
  expect(
    resolveLineEndIfClickPastText({
      clientX: 120,
      clientY: 30,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBe(10);
});

test("点在文字上不改光标位置", () => {
  expect(
    resolveLineEndIfClickPastText({
      clientX: 25,
      clientY: 10,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBeNull();
});

test("空块或点在行带外：行内逻辑不接管", () => {
  expect(
    resolveLineEndIfClickPastText({
      clientX: 120,
      clientY: 10,
      start: 4,
      end: 4,
      coordsAtPos: twoLineCoords,
    }),
  ).toBeNull();
  expect(
    resolveLineEndIfClickPastText({
      clientX: 120,
      clientY: 80,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBeNull();
});

test("块间空隙归上方块，命中盒子时用最内层", () => {
  const blocks = [
    { top: 0, bottom: 20 },
    { top: 28, bottom: 48 },
  ];
  expect(pickOwningBlockIndex(blocks, 10)).toBe(0);
  expect(pickOwningBlockIndex(blocks, 24)).toBe(0);
  expect(pickOwningBlockIndex(blocks, 30)).toBe(1);
  expect(pickOwningBlockIndex(blocks, -4)).toBe(0);

  const nested = [
    { top: 0, bottom: 100 },
    { top: 40, bottom: 60 },
  ];
  expect(pickOwningBlockIndex(nested, 50)).toBe(1);
  expect(pickOwningBlockIndex(nested, 80)).toBe(0);
  expect(pickOwningBlockIndex([], 10)).toBeNull();
});

test("Notion：点块间空隙落到该块行尾，即使 X 还在文字正下方", () => {
  expect(
    resolveBlockEmptyClickPos({
      clientX: 10,
      clientY: 50,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBe(10);
  expect(
    resolveBlockEmptyClickPos({
      clientX: 10,
      clientY: -8,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBe(5);
});

test("点在字上仍不改光标；空块停在该块", () => {
  expect(
    resolveBlockEmptyClickPos({
      clientX: 25,
      clientY: 10,
      start: 0,
      end: 10,
      coordsAtPos: twoLineCoords,
    }),
  ).toBeNull();
  expect(
    resolveBlockEmptyClickPos({
      clientX: 120,
      clientY: 10,
      start: 4,
      end: 4,
      coordsAtPos: twoLineCoords,
    }),
  ).toBe(4);
});

/** 行高留白：两行 caret 带不挨着，中间是字内垂直空隙。 */
function gappyLineCoords(pos: number): CaretCoords {
  if (pos <= 5) {
    return { top: 0, bottom: 16, left: pos * 10, right: pos * 10 + 8 };
  }
  const col = pos - 6;
  return { top: 28, bottom: 44, left: col * 10, right: col * 10 + 8 };
}

test("点在字的行高留白里不拽到段尾", () => {
  expect(
    resolveBlockEmptyClickPos({
      clientX: 25,
      clientY: 22,
      start: 0,
      end: 10,
      coordsAtPos: gappyLineCoords,
    }),
  ).toBeNull();
});

test("点在行高留白的行尾空白落到最近行行尾", () => {
  expect(
    resolveBlockEmptyClickPos({
      clientX: 120,
      clientY: 22,
      start: 0,
      end: 10,
      coordsAtPos: gappyLineCoords,
    }),
  ).toBe(5);
});

test("非元素目标不接管", () => {
  expect(isInteractiveCaretClickTarget(null)).toBe(false);
  expect(isInteractiveCaretClickTarget("text" as unknown as EventTarget)).toBe(
    false,
  );
});

test("表格手柄列入空白点击忽略选择器", () => {
  const source = readFileSync(
    new URL(
      "../../src/components/editor/extensions/trailingBlankClickExtension.ts",
      import.meta.url,
    ),
    "utf8",
  );
  expect(source).toContain('".bn-table-handle"');
  expect(source).toContain('".bn-table-cell-handle"');
});

test("行内内容拉满剩余宽度，列表 marker 不接收指针", () => {
  const surfaceCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/surface.css", import.meta.url),
    "utf8",
  );
  const listsCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/lists.css", import.meta.url),
    "utf8",
  );
  const editorTsx = readFileSync(
    new URL("../../src/components/editor/core/Editor.tsx", import.meta.url),
    "utf8",
  );

  expect(surfaceCss).toContain("flex: 1 1 auto");
  expect(surfaceCss).toContain(".bn-block-content > .bn-inline-content");
  expect(surfaceCss).toContain(
    '.bn-block-content[data-content-type="callout"] > .react-renderer',
  );
  const tablesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/tables-callouts.css", import.meta.url),
    "utf8",
  );
  expect(tablesCss).toContain("[data-content-type=\"table\"]");
  expect(tablesCss).toContain("td");
  expect(tablesCss).toContain("th");
  expect(tablesCss).toContain("> .bn-inline-content");
  expect(surfaceCss).toContain(
    ".bn-block-content:has(.ProseMirror-trailingBreak:only-child)",
  );
  expect(surfaceCss).toContain("flex-grow: 0");
  expect(listsCss).toContain("pointer-events: none");
  expect(editorTsx).toContain("gooseTrailingBlankClickExtension");
});

test("标注块嵌套 inline 算文本块，表格外壳不算", () => {
  installExportDom();
  const callout = document.createElement("div");
  callout.className = "bn-block-content";
  callout.setAttribute("data-content-type", "callout");
  callout.innerHTML =
    '<div class="react-renderer"><div data-callout="true"><div class="callout-content bn-inline-content">提示</div></div></div>';
  expect(isTextBlockContent(callout)).toBe(true);

  const quote = document.createElement("div");
  quote.className = "bn-block-content";
  quote.setAttribute("data-content-type", "quote");
  quote.innerHTML =
    '<blockquote><div class="bn-inline-content">引用</div></blockquote>';
  expect(isTextBlockContent(quote)).toBe(true);

  const paragraph = document.createElement("div");
  paragraph.className = "bn-block-content";
  paragraph.setAttribute("data-content-type", "paragraph");
  paragraph.innerHTML = '<div class="bn-inline-content">正文</div>';
  expect(isTextBlockContent(paragraph)).toBe(true);

  const table = document.createElement("div");
  table.className = "bn-block-content";
  table.setAttribute("data-content-type", "table");
  table.innerHTML =
    '<table><td><div class="bn-inline-content">单元格</div></td></table>';
  expect(isTextBlockContent(table)).toBe(false);

  const image = document.createElement("div");
  image.className = "bn-block-content";
  image.setAttribute("data-content-type", "image");
  expect(isTextBlockContent(image)).toBe(false);
});

test("点击落在标注块内部时用该块，不按 Y 判给标题", () => {
  installExportDom();
  const title = document.createElement("div");
  title.className = "bn-block-content";
  title.setAttribute("data-content-type", "heading");
  title.innerHTML = '<h1 class="bn-inline-content">标题</h1>';

  const callout = document.createElement("div");
  callout.className = "bn-block-content";
  callout.setAttribute("data-content-type", "callout");
  const inner = document.createElement("div");
  inner.className = "callout-content bn-inline-content";
  inner.textContent = "提示";
  const shell = document.createElement("div");
  shell.setAttribute("data-callout", "true");
  shell.append(inner);
  const renderer = document.createElement("div");
  renderer.className = "react-renderer";
  renderer.append(shell);
  callout.append(renderer);

  expect(contentBlockFromEventTarget(inner)).toBe(callout);
  expect(contentBlockFromEventTarget(title)).toBe(title);
  expect(contentBlockFromEventTarget(null)).toBeNull();
});

function headingBlock(text: string) {
  const title = document.createElement("div");
  title.className = "bn-block-content";
  title.setAttribute("data-content-type", "heading");
  title.innerHTML = `<h1 class="bn-inline-content">${text}</h1>`;
  return title;
}

function tableBlockWithCell(text: string) {
  const table = document.createElement("div");
  table.className = "bn-block-content";
  table.setAttribute("data-content-type", "table");
  table.innerHTML = `<table><tbody><tr><td><div class="bn-inline-content">${text}</div></td></tr></tbody></table>`;
  return {
    table,
    cellInline: table.querySelector(".bn-inline-content") as HTMLElement,
  };
}

function mediaBlock(type: string) {
  const el = document.createElement("div");
  el.className = "bn-block-content";
  el.setAttribute("data-content-type", type);
  const inner = document.createElement("div");
  inner.className = "media-preview";
  el.append(inner);
  return { block: el, inner };
}

test("点在表格单元格内用该格，不按 Y 判给上方标题", () => {
  installExportDom();
  const title = headingBlock("我的账号");
  const { table, cellInline } = tableBlockWithCell("13192576263");

  expect(isTextBlockContent(table)).toBe(false);
  expect(contentBlockFromEventTarget(cellInline)).toBeNull();
  expect(tableCellInlineFromEventTarget(cellInline)).toBe(cellInline);
  expect(pickTrailingBlankContentEl(cellInline, [title], 80)).toBe(cellInline);
  expect(pickTrailingBlankContentEl(cellInline, [title], 10)).toBe(cellInline);
});

test("点在图片/视频/文件/分割线块内不把光标判给标题", () => {
  installExportDom();
  const title = headingBlock("我的账号");
  for (const type of ["image", "imageResize", "video", "file", "audio", "divider"]) {
    const { block, inner } = mediaBlock(type);
    expect(isTextBlockContent(block)).toBe(false);
    expect(contentBlockFromEventTarget(inner)).toBeNull();
    expect(pickTrailingBlankContentEl(inner, [title], 80)).toBeNull();
  }
});

test("点在表格外壳但未落到单元格时也不判给标题", () => {
  installExportDom();
  const title = headingBlock("我的账号");
  const { table } = tableBlockWithCell("13192576263");
  expect(pickTrailingBlankContentEl(table, [title], 80)).toBeNull();
});
