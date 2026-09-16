import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const readSource = (path: string) => readFileSync(path, "utf8");

test("块工具栏通过 pressed 状态统一使用强调色令牌", () => {
  const css = readSource("src/pages/workspace/styles/editor-base/toolbars.css");
  const imageToolbar = readSource(
    "src/components/editor/image/ImageToolbar.tsx",
  );
  const videoToolbar = readSource(
    "src/components/editor/blocks/video/VideoToolbar.tsx",
  );

  expect(css).toContain('.goose-block-toolbar-control[aria-pressed="true"]');
  expect(css).toContain("background: var(--goose-interactive-selected)");
  expect(css).toContain("color: var(--goose-interactive-selected-fg)");
  expect(imageToolbar).toContain(
    'className="goose-editor-context-ui goose-block-toolbar-surface',
  );
  expect(videoToolbar).toContain("aria-pressed={pressed}");
  expect(videoToolbar).not.toContain('"bg-accent text-foreground"');
});

test("页面菜单保持视口尺寸及独立表面层次", () => {
  const pageMenu = readSource(
    "src/pages/workspace/components/page/PageMenu.tsx",
  );
  const surfaceCss = readSource(
    "src/pages/workspace/components/page/page-menu.css",
  );
  const menuClasses = pageMenu
    .match(/<PopoverContent\s+className="([^"]+)"/)?.[1]
    .split(/\s+/);

  expect(menuClasses).toEqual(
    expect.arrayContaining([
      "goose-page-menu-surface",
      "goose-floating-surface",
      "max-h-[calc(100vh-24px)]",
      "w-[272px]",
      "max-w-[calc(100vw-16px)]",
    ]),
  );
  expect(menuClasses).not.toContain("border-border");
  expect(menuClasses).not.toContain("shadow-md");
  expect(surfaceCss).toContain(".goose-page-menu-surface:focus");
  expect(surfaceCss).toContain(".goose-page-menu-surface:focus-visible");
  expect(surfaceCss).toContain(
    "box-shadow: var(--goose-menu-shadow) !important",
  );
  expect(pageMenu).toContain("min-w-[144px]");
  expect(pageMenu).toContain("sideOffset={6}");
  expect(pageMenu).toContain("<FontSelector");
  expect(pageMenu).toContain("compact");

  expect(pageMenu).toContain("function PageExportSubmenu");
  expect(pageMenu).toContain('side="right"');
  expect(pageMenu).toContain("pointermove");
  expect(pageMenu).toContain("pointInElement");
  expect(pageMenu).toContain("modal={false}");
  expect(pageMenu).toContain("goose-page-menu-export");
  expect(pageMenu).toContain("EXPORT_OPEN_DELAY_MS");
  expect(pageMenu).not.toContain("onPointerLeave");
  expect(pageMenu).not.toContain('animation="reveal"');
  expect(surfaceCss).toContain('[data-slot="popover-trigger"]');
  expect(surfaceCss).toContain("width: 100%");
  expect(surfaceCss).not.toContain(".goose-page-menu-export[data-entering=\"true\"]");
});

test("页面字体选项用边框表达选中，避免 focus 清掉 ring 时闪框", () => {
  const fontSelector = readSource(
    "src/pages/workspace/components/shared/FontSelector.tsx",
  );

  expect(fontSelector).toContain("border-2");
  expect(fontSelector).toContain("border-primary");
  expect(fontSelector).toContain("aria-pressed={selected}");
  expect(fontSelector).not.toContain("ring-2");
  expect(fontSelector).not.toContain("transition-all");
});
