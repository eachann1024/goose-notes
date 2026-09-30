import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const css = readFileSync(
  "src/pages/workspace/styles/block-background.css",
  "utf8",
);

test("块背景向左右留白外扩且不挤压原输入宽度", () => {
  expect(css).toContain(".bn-block-content[data-background-color]");
  expect(css).toContain("width: calc(100% + 12px)");
  expect(css).toContain("margin-left: -6px");
  expect(css).toContain("margin-right: -6px");
  expect(css).toContain("padding-left: 6px");
  expect(css).toContain("padding-right: 6px");
});

test("标题不论折叠都左右外扩 8px，文字仍落在原基线", () => {
  expect(css).toContain('.bn-block-content[data-content-type="heading"]');
  expect(css).toContain("width: calc(100% + 16px)");
  expect(css).toContain("margin-left: -8px");
  expect(css).toContain("margin-right: -8px");
  expect(css).toContain("padding-left: 8px");
  expect(css).toContain("padding-right: 8px");
});

test("块背景只画内容行，父块保持透明", () => {
  expect(css).toContain(
    ".bn-block:has(> .bn-block-content[data-background-color])",
  );
  expect(css).toContain("background-color: transparent");
});
