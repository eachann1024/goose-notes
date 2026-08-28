import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("斜杠菜单不再含折叠一级/二级/三级标题", () => {
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
  expect(source).toContain('props: { level: 1, isToggleable: true }');
  expect(source).toContain('props: { level: 2, isToggleable: true }');
  expect(source).toContain('props: { level: 3, isToggleable: true }');
});
