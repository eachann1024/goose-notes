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
