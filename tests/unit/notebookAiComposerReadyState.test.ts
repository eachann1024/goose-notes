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
  expect(composer).toContain("items-center gap-2");
  expect(composer).toContain("h-8 w-8");
  expect(composer).not.toContain("rounded-[12px]");
  expect(composer).not.toContain("--goose-block-subtle-bg");
  expect(composer).not.toContain("flex flex-col");
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
