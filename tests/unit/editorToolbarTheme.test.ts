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
    .match(/<DropdownMenuContent\s+className="([^"]+)"/)?.[1]
    .split(/\s+/);

  expect(menuClasses).toEqual(expect.arrayContaining([
    "goose-page-menu-surface",
    "max-h-[calc(100vh-24px)]",
    "w-[272px]",
    "max-w-[calc(100vw-16px)]",
    "border",
    "border-border",
    "shadow-md",
    "rounded-lg",
  ]));
  expect(surfaceCss).toContain(".goose-page-menu-surface:focus");
  expect(surfaceCss).toContain(".goose-page-menu-surface:focus-visible");
  expect(surfaceCss).toContain("box-shadow: var(--shadow-md) !important");
  expect(pageMenu).toContain(
    'className="min-w-[144px]',
  );
  expect(pageMenu).toContain(
    "sideOffset={6}",
  );
  expect(pageMenu).toContain("<FontSelector");
  expect(pageMenu).toContain("compact");
});
