import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("ContextMenu 用捕获阶段 pointerdown 关闭，不把整块 trigger 当成内部", () => {
  const source = readFileSync("src/components/ui/context-menu.tsx", "utf8");
  expect(source).toContain("outsidePress: false");
  expect(source).toContain(
    'document.addEventListener("pointerdown", closeOnOutside, true)',
  );
  expect(source).toContain("isInsideMenuFloating");
});
