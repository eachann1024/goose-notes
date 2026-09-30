import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { dropLineTopPx } from "../../src/pages/workspace/components/sidebar/main-tree/mainTreeDragGeometry";

test("拖动线贴在真实行顶，最后一项之后贴行底", () => {
  expect(dropLineTopPx(0, [0, 32, 64], 32)).toBe(0);
  expect(dropLineTopPx(1, [0, 33, 67], 32)).toBe(33);
  expect(dropLineTopPx(3, [0, 33, 67], 34)).toBe(101);
  expect(dropLineTopPx(0, [], 32)).toBe(0);
});

test("主树统一使用 RCT 的父级与插入位置，跨目录也显示落线", () => {
  const item = readFileSync("src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx", "utf8");
  const tree = readFileSync("src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx", "utf8");
  const css = readFileSync("src/pages/workspace/components/sidebar/main-tree/main-tree.css", "utf8");
  expect(item).not.toMatch(/mb-0\.5/);
  expect(item).toContain("normalizeMainTreeDragOver(event, event.currentTarget)");
  expect(item).toContain("snapDragBetweenLine");
  expect(item).not.toContain("hideSortLine");
  expect(tree).toContain("--main-tree-row-height");
  expect(tree).not.toContain("takeLocalFolderDropParent");
  expect(tree).toContain("renderDepthOffset={MAIN_TREE_INDENT}");
  expect(css).toContain("--main-tree-row-height");
  expect(css).toContain("min-height: 100%");
});
