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

test("收藏平铺树不渲染展开箭头槽", () => {
  const sidebarTree = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/SidebarTree.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const favorites = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/FavoritesSection.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const treeViewport = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/tree/TreeViewport.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(favorites).toContain("flatRoots");
  expect(favorites).toContain("allowNest={false}");
  expect(sidebarTree).toContain("showExpandControls={!flatRoots}");
  expect(treeRow).toContain("shouldRenderExpandArrowSlot");
  expect(treeRow).toContain("showExpandControls");
  expect(treeViewport).toContain("shouldRenderExpandArrowSlot");
  expect(treeViewport).toContain("showExpandControls");
});

test("收藏行字号图标与主树列表一致", () => {
  const mainTree = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const mainTreeRow = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/main-tree/MainTreeRowShell.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(mainTreeRow).toContain("text-[13px] font-medium leading-none");
  expect(treeRow).toContain("text-[13px] font-medium leading-none");
  expect(treeRow).toContain('className="text-[13px] leading-snug"');
  expect(treeRow).not.toMatch(
    /sidebar-tree-row[\s\S]{0,220}text-sm font-medium/,
  );
  expect(mainTree).toContain(
    "main-tree-local-folder-icon flex items-center justify-center h-5 w-5 shrink-0 mr-0.5",
  );
  expect(treeRow).toContain(
    "pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center mr-0.5",
  );
  expect(treeRow).not.toContain("IconSelector");
  expect(treeRow).not.toContain("goose-page-icon-trigger");
});
