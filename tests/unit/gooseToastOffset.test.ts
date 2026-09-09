import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("桌面端通知从标题栏下方、正文首行工具栏对齐处开始", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  const toastCss = readFileSync("src/styles/goose-toast.css", "utf8");
  expect(indexCss).toContain("--goose-toast-offset-top");
  expect(indexCss).toContain("var(--electron-titlebar-height, 2.75rem)");
  expect(toastCss).toContain(
    "top: var(--goose-toast-offset-top, var(--offset-top, 22px)) !important;",
  );
});
