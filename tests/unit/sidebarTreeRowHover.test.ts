import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const sidebarDndCss = readFileSync(
  new URL("../../src/pages/workspace/styles/sidebar-dnd.css", import.meta.url),
  "utf8",
);
const workspaceStyles = readFileSync(
  new URL("../../src/pages/workspace/styles/index.css", import.meta.url),
  "utf8",
);
const treeRow = readFileSync(
  new URL(
    "../../src/pages/workspace/components/sidebar/tree/TreeRow.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("收藏树 hover 不覆盖选中，且使用共享 hover 三件套", () => {
  expect(sidebarDndCss).toContain(".sidebar-tree-row--hovered");
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--selected[\s\S]{0,120}color:\s*var\(--goose-interactive-selected-fg\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--selected[\s\S]{0,240}background:\s*var\(--goose-interactive-selected\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--hovered:not\(\.sidebar-tree-row--selected\)[\s\S]{0,240}background:\s*var\(--goose-interactive-hover\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--hovered:not\(\.sidebar-tree-row--selected\)[\s\S]{0,240}color:\s*var\(--goose-interactive-hover-fg\)/,
  );
  expect(sidebarDndCss).toMatch(
    /\.sidebar-tree-row--hovered:not\(\.sidebar-tree-row--selected\)[\s\S]{0,320}box-shadow:\s*inset 0 0 0 1px var\(--goose-interactive-hover-border\)/,
  );
  const cssWithoutComments = sidebarDndCss.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(cssWithoutComments).not.toContain(".sidebar-tree-row:hover");
  expect(treeRow).toContain("sidebar-tree-row--hovered");
  expect(treeRow).not.toMatch(
    /hover:text-foreground[\s\S]{0,80}sidebar-tree-row/,
  );
  expect(treeRow).not.toContain("hover:text-foreground");
});

test("主树与侧栏树行继续使用圆角高亮", () => {
  const mainTreeRow = readFileSync(
    new URL("../../src/pages/workspace/components/sidebar/main-tree/MainTreeRowShell.tsx", import.meta.url),
    "utf8",
  );
  expect(mainTreeRow).toMatch(/main-tree-row[\s\S]{0,120}rounded-lg/);
  expect(treeRow).toMatch(/sidebar-tree-row[\s\S]{0,120}rounded-lg/);
});

test("侧栏树行字号图标与主树列表一致", () => {
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
  expect(mainTree).toContain("main-tree-row-icon-group");
  expect(mainTree).toContain("MainTreeRowDisclosure");
  expect(mainTree).toContain(
    "style={{ width: isFolderRow ? INDENT * 2 : INDENT, height: INDENT }}",
  );
  expect(treeRow).toContain("LucideIcons.ChevronRight");
  expect(treeRow).toContain("style={{ width: TREE_INDENT }}");
  expect(treeRow).toContain(
    "pointer-events-none flex h-[18px] w-[18px] shrink-0 items-center justify-center",
  );
  expect(treeRow).not.toContain("IconSelector");
  expect(treeRow).not.toContain("goose-page-icon-trigger");
});
