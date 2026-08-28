import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { ensureBlockMoveDragging } from "../../src/components/editor/core/ensureBlockMoveDragging";
import {
  isFoldableHeadingBlock,
  isHeadingBlock,
  toggleHeadingCollapsed,
} from "../../src/components/editor/core/toggleHeadingGutter";

test("折叠块不再画左侧引用线", () => {
  const togglesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/toggles.css", import.meta.url),
    "utf8",
  );
  expect(togglesCss).not.toContain("left: -14px");
  expect(togglesCss).not.toMatch(
    /\.bn-block-group::before[\s\S]*width:\s*1px/,
  );
});

test("标题区块折叠用 data-goose-section-hidden 隐藏后续兄弟", () => {
  const togglesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/toggles.css", import.meta.url),
    "utf8",
  );
  expect(togglesCss).toContain('[data-goose-section-hidden="true"]');
  expect(togglesCss).toContain("prefers-reduced-motion");
  expect(togglesCss).not.toContain("data-is-toggleable");
});

test("标题 caret 扩展打标 + CSS 用强调色前景与 caret", () => {
  const surfaceCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/surface.css", import.meta.url),
    "utf8",
  );
  expect(surfaceCss).toContain('[data-goose-heading-caret="true"]');
  expect(surfaceCss).not.toMatch(
    /\[data-content-type="heading"\]:focus-within/,
  );
  expect(surfaceCss).toContain("var(--goose-interactive-selected-fg)");
  expect(surfaceCss).toContain("caret-color");
});

test("侧栏折叠按钮用 goose-heading-fold-btn + toggles.css 强调色 hover", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  const togglesCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/toggles.css", import.meta.url),
    "utf8",
  );
  expect(source).toContain("goose-heading-fold-btn");
  expect(source).toContain('data-fold-hot');
  expect(source).toContain("onMouseEnter");
  expect(source).toContain("onMouseLeave");
  expect(source).toContain("toggleHeadingCollapsed");
  expect(source).not.toContain("clickHeadingToggleButton");
  expect(togglesCss).toContain(
    "html body .bn-side-menu button.goose-heading-fold-btn:hover",
  );
  expect(togglesCss).toContain(
    'html body .bn-side-menu button.goose-heading-fold-btn[data-fold-hot="true"]',
  );
  expect(togglesCss).toContain("var(--goose-icon-chip-on-selected)");
  expect(togglesCss).toContain("var(--goose-interactive-selected-fg)");
});

test("PageHeader 标题输入 focus 用强调色前景与 caret", () => {
  const source = readFileSync(
    new URL("../../src/pages/workspace/components/page/SingleTabTitle.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("focus:text-[var(--goose-interactive-selected-fg)]");
  expect(source).toContain("caret-[var(--goose-interactive-selected-fg)]");
});

test("SideMenu 水平锚内容列左缘，垂直对齐标题文字中线", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("referencePos.left - SIDE_MENU_CONTENT_GAP");
  expect(source).not.toContain("textRect.left");
  expect(source).toContain("textRect.top + textRect.height / 2");
  expect(source).toContain('transform: "translate(-100%, -50%)"');
});

test("SideMenu 对非首块 heading 渲染折叠按钮，顺序为 + / 折叠 / grip", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  const gutter = readFileSync(
    new URL("../../src/components/editor/core/toggleHeadingGutter.ts", import.meta.url),
    "utf8",
  );
  expect(source).toContain("isFoldableHeadingBlock");
  expect(source).toContain("queryHeadingTextRect");
  expect(source).toContain("ChevronRight");
  expect(source).toContain("aria-expanded");
  expect(source).toContain("展开章节");
  expect(source).toContain("收起章节");
  expect(source).toContain("toggleHeadingCollapsed");
  expect(source).toContain("showHeadingToggle");
  expect(gutter).toContain("isFoldableHeadingBlock");
  expect(gutter).toContain('block?.type === "heading"');
  expect(gutter).not.toContain("isToggleable");
  expect(gutter).not.toContain(".bn-toggle-button");
  expect(source).toContain("draggable={false}");

  const renderStart = source.indexOf("return createPortal");
  const renderSource = renderStart >= 0 ? source.slice(renderStart) : source;
  const plusIndex = renderSource.indexOf("<Plus");
  const toggleIndex = renderSource.indexOf("onClick={handleToggleHeading}");
  expect(plusIndex).toBeGreaterThan(-1);
  expect(toggleIndex).toBeGreaterThan(-1);
  expect(plusIndex).toBeLessThan(toggleIndex);
});

test("isFoldableHeadingBlock 排除文档首块", () => {
  expect(isHeadingBlock({ type: "heading" })).toBe(true);
  expect(isHeadingBlock({ type: "paragraph" })).toBe(false);
  expect(
    isFoldableHeadingBlock({ id: "title", type: "heading" }, "title"),
  ).toBe(false);
  expect(
    isFoldableHeadingBlock({ id: "h2", type: "heading" }, "title"),
  ).toBe(true);
  expect(
    isFoldableHeadingBlock({ id: "h2", type: "paragraph" }, "title"),
  ).toBe(false);
});

test("侧栏把手不截获块拖放，已有 dragging 时不覆盖", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("ensureBlockMoveDragging");
  expect(source).not.toMatch(/onDrop=\{/);
  const existing = { slice: {} as never, move: false };
  const view = {
    dragging: existing,
    state: { schema: { nodes: {} } },
  } as never;
  const dt = {
    getData: () => "<div data-id='x'></div>",
  } as unknown as DataTransfer;
  ensureBlockMoveDragging(view, dt);
  expect(view.dragging).toBe(existing);
});

test("toggleHeadingCollapsed 切换 heading.props.collapsed", () => {
  const updates: unknown[] = [];
  const editor = {
    getBlock: (id: string) =>
      id === "h2"
        ? { id: "h2", type: "heading", props: { level: 2, collapsed: false } }
        : undefined,
    updateBlock: (_block: unknown, patch: unknown) => updates.push(patch),
  };
  toggleHeadingCollapsed(editor as never, "h2");
  expect(updates).toEqual([{ props: { collapsed: true } }]);
});
