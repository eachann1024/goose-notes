import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const sidebarDndCss = readFileSync(
  new URL("../../src/pages/workspace/styles/sidebar-dnd.css", import.meta.url),
  "utf8",
);
const treeRow = readFileSync(
  new URL(
    "../../src/pages/workspace/components/sidebar/tree/TreeRow.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("收藏树 hover 与选中共用强调蓝，不用黑色前景", () => {
  expect(sidebarDndCss).toContain(".sidebar-tree-row--hovered");
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--hovered[\s\S]{0,120}color:\s*var\(--goose-interactive-selected-fg\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--selected[\s\S]{0,160}background:\s*var\(--goose-interactive-selected\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--hovered[\s\S]{0,120}background:\s*var\(--goose-interactive-selected\)/,
  );
  const cssWithoutComments = sidebarDndCss.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(cssWithoutComments).not.toContain(".sidebar-tree-row:hover");
  expect(treeRow).toContain("sidebar-tree-row--hovered");
  expect(treeRow).not.toMatch(
    /hover:text-foreground[\s\S]{0,80}sidebar-tree-row/,
  );
  expect(treeRow).not.toContain("hover:text-foreground");
});
