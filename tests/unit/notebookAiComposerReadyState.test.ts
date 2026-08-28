import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { isComposerPayloadEmpty } from "../../src/components/editor/ai/composer/composerTokens";

const indexCss = readFileSync(
  new URL("../../src/index.css", import.meta.url),
  "utf8",
);
const pageHeader = readFileSync(
  new URL(
    "../../src/pages/workspace/components/page/PageHeader.tsx",
    import.meta.url,
  ),
  "utf8",
);
const composer = readFileSync(
  new URL(
    "../../src/pages/workspace/components/notebook-ai/Composer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const nativeEditor = readFileSync(
  new URL(
    "../../src/components/editor/ai/composer/useComposerNativeEditor.ts",
    import.meta.url,
  ),
  "utf8",
);
const modelSelector = readFileSync(
  new URL(
    "../../src/pages/workspace/components/notebook-ai/ModelSelectorPopover.tsx",
    import.meta.url,
  ),
  "utf8",
);
const input = readFileSync(
  new URL(
    "../../src/components/editor/ai/composer/AiComposerInput.tsx",
    import.meta.url,
  ),
  "utf8",
);
const expandLayout = readFileSync(
  new URL(
    "../../src/components/editor/ai/composer/composerExpandLayout.ts",
    import.meta.url,
  ),
  "utf8",
);

function firstRuleContaining(css: string, needle: string): string {
  const selectorIndex = css.indexOf(needle);
  if (selectorIndex < 0) return "";
  const bodyStart = css.indexOf("{", selectorIndex) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

test("标签栏 AI 入口选中时用强调色底，不再透明", () => {
  const pressed = firstRuleContaining(
    indexCss,
    '.ai-icon-button[aria-pressed="true"]',
  );
  expect(pressed).toContain("background: var(--goose-interactive-selected)");
  expect(pressed).toContain("color: var(--goose-interactive-selected-fg)");
  expect(pressed).not.toContain("transparent");

  const darkPressed = firstRuleContaining(
    indexCss,
    '.dark .ai-icon-button[aria-pressed="true"]',
  );
  expect(darkPressed).toContain(
    "background: var(--goose-interactive-selected)",
  );
  expect(darkPressed).not.toContain("transparent");

  expect(pageHeader).toContain(
    "aria-pressed:bg-[var(--goose-interactive-selected)]",
  );
  expect(indexCss).toContain(
    '.ai-icon-button[aria-pressed="true"] .ai-icon[data-ai-state="idle"] .ai-icon-glyph path',
  );
  expect(indexCss).toContain("stroke: var(--goose-interactive-selected-fg)");
});

test("发送按钮切回面板时按草稿决定高亮", () => {
  expect(composer).toContain("composerDraftHasContent(seedContent)");
  expect(nativeEditor).toContain("onIsEmptyChange?.(empty)");
});

test("面板输入条是胶囊白底单行，跟 A 方案原型一致", () => {
  expect(composer).toContain("rounded-full");
  expect(composer).toContain("min-h-[44px]");
  expect(composer).toContain("bg-[hsl(var(--goose-editor-bg))]");
  expect(composer).toContain("items-center");
  expect(composer).toContain("gap-2");
  expect(composer).toContain("h-8 w-8");
  expect(composer).not.toContain("rounded-[12px]");
  expect(composer).not.toContain("--goose-block-subtle-bg");
  expect(composer).not.toContain("flex flex-col");
});

test("内容到模型位或硬换行时用 wrap 切两行，输入独占上行", () => {
  // 用 flex-wrap + order-first/basis-full 切两行，不用 flex-col 换序（会重挂载输入框）
  expect(composer).toContain("flex-wrap");
  expect(composer).toContain("order-first");
  expect(composer).toContain("basis-full");
  expect(composer).toContain("data-expanded");
  expect(composer).toContain("rounded-[20px]");
  expect(composer).toContain("rounded-full");
  expect(composer).not.toContain("flex flex-col");
  expect(composer).toContain("shouldExpandComposer");
  expect(composer).toContain("isEditorDomEmpty");
  expect(composer).not.toContain('querySelector("br")');
  expect(composer).toContain("ResizeObserver");
  expect(composer).toContain("modelWrapRef");
  expect(nativeEditor).toContain("onLayoutMeasure");
});

test("清空和发送会收回单行胶囊", () => {
  expect(composer).toContain("collapseChrome");
  expect(input).toContain('--ai-composer-h", "24px"');
  expect(input).toContain("onMultilineChange?.(false)");
  expect(input).toContain("onLayoutMeasure?.()");
});

test("面板输入区 4 行封顶，多行切 20px 圆角", () => {
  expect(nativeEditor).toContain("max-h-[96px]");
  expect(nativeEditor).not.toContain("max-h-[144px]");
  expect(nativeEditor).toContain("--ai-composer-h");
  expect(nativeEditor).toContain("onMultilineChange");
  expect(nativeEditor).toContain("isEditorDomEmpty(el)");
  expect(composer).toContain("rounded-[20px]");
  expect(composer).toContain("rounded-full");
  expect(composer).toContain("notebook-ai-composer-shell");
  expect(composer).toContain("onMultilineChange={setMultiline}");
});

test("全局滚动条是低入侵 overlay，不再除编辑器外全部藏条", () => {
  expect(indexCss).not.toContain(
    "*:not(.bn-editor):not(.page-scroll-container)::-webkit-scrollbar",
  );
  expect(indexCss).not.toContain(
    "*:not(.bn-editor):not(.page-scroll-container) {",
  );
  const thumb = firstRuleContaining(indexCss, "*::-webkit-scrollbar-thumb {");
  expect(thumb).toContain("border: 2px solid transparent");
  expect(thumb).toContain("border-radius: 999px");
  expect(thumb).toContain("background: rgba(0, 0, 0, 0)");
  expect(indexCss).toContain("scrollbar-width: thin");
});

test("模型选择器用固定 max-width，不用百分比截瘪", () => {
  expect(modelSelector).toContain("max-w-[12.5rem]");
  expect(modelSelector).not.toContain("32%");
  expect(modelSelector).toContain("shrink-0");
  expect(modelSelector).toContain("truncate");
});

test("Composer 附件钮与模型选择 hover 用强调色前景", () => {
  expect(composer).toContain(
    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
  );
  expect(composer).toContain('aria-label="上传图片"');
  expect(modelSelector).toContain(
    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
  );
});

test("测宽克隆必须去掉编辑器宽度类，不能只 clone 就量", () => {
  expect(expandLayout).toContain("cloneNode(true)");
  expect(expandLayout).toContain('clone.className = ""');
  expect(expandLayout).toContain("clone.remove()");
  expect(composer).toContain("measureNowrapContentWidth");
});

test("无文本、引用、图片、Skill 才视为输入为空", () => {
  expect(
    isComposerPayloadEmpty({
      promptText: "",
      references: [],
      images: [],
      skills: [],
    }),
  ).toBe(true);
  expect(
    isComposerPayloadEmpty({
      promptText: "还没发出去",
      references: [],
      images: [],
      skills: [],
    }),
  ).toBe(false);
  expect(
    isComposerPayloadEmpty({
      promptText: "",
      references: [
        {
          pageId: "p1",
          workspaceId: "nb1",
          titleSnapshot: "笔记",
          sourceType: "app-page",
        },
      ],
      images: [],
      skills: [],
    }),
  ).toBe(false);
});
