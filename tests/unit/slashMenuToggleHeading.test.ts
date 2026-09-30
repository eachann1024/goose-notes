import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("斜杠菜单标题 props 不含 isToggleable", () => {
  const source = readFileSync(
    new URL(
      "../../src/components/editor/core/blocknoteSlashItems.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(source).not.toContain("折叠一级标题");
  expect(source).not.toContain("折叠二级标题");
  expect(source).not.toContain("折叠三级标题");
  expect(source).not.toContain('title: "折叠列表"');
  expect(source).not.toContain("isToggleable");
  expect(source).toContain('props: { level: 1 }');
  expect(source).toContain('props: { level: 2 }');
  expect(source).toContain('props: { level: 3 }');
});
