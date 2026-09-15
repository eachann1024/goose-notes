import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

test("深色模式把 HeroUI text-muted 映射成弱化文字色，避免图标消失", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  expect(css).toContain(".text-muted");
  expect(css).toContain("color: hsl(var(--muted-foreground))");
  expect(css).toContain(".close-button.close-button--default");
  expect(css).toContain("background-color: transparent");
});

test("HeroUI Tabs 未选中态不用底色当字色", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const tabs = readFileSync(resolve("src/components/ui/tabs.tsx"), "utf8");
  expect(css).toContain('.tabs__tab:not([data-selected="true"])');
  expect(css).toContain("color: hsl(var(--muted-foreground))");
  expect(tabs).toContain("text-muted-foreground");
});

test("HeroUI Tabs 点击时不走透明度、阴影和离场定位", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const tabs = readFileSync(resolve("src/components/ui/tabs.tsx"), "utf8");
  expect(css).toContain(".tabs__tab {\n  transition: none;");
  expect(css).toContain("opacity: 1;");
  expect(css).toContain(".tabs__indicator {\n  display: none;");
  expect(css).toContain('.tabs__panel[data-exiting="true"]');
  expect(css).toContain("position: static;");
  expect(tabs).not.toContain("transition-all");
  expect(tabs).not.toContain("data-[selected]:shadow");
});
