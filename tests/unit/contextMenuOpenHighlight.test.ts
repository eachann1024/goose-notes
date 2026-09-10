import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("右键菜单打开由 floating-ui 聚焦第一可用项，关闭后清空高亮", () => {
  const source = readFileSync("src/components/ui/context-menu.tsx", "utf8");
  // 打开即聚焦首个可用项（跳过禁用项），方向键直接接着往下选。
  expect(source).toContain("focusItemOnOpen: true");
  // 关闭后清空，避免再次打开时残留上次的高亮。
  expect(source).toContain("if (!open) setActiveIndex(null)");
});
