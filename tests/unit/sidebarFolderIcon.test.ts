import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";
import {
  isSidebarFolderRow,
  shouldShowEmptyFolderPlaceholder,
} from "../../src/pages/workspace/components/sidebar/local-file-icon";

const mainTreeItem = readFileSync(
  resolve("src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx"),
  "utf8",
);
const treeRow = readFileSync(
  resolve("src/pages/workspace/components/sidebar/tree/TreeRow.tsx"),
  "utf8",
);
const sidebarContextMenu = readFileSync(
  resolve("src/pages/workspace/components/sidebar/SidebarContextMenu.tsx"),
  "utf8",
);
const treeAdapter = readFileSync(
  resolve("src/pages/workspace/components/sidebar/main-tree/treeAdapter.ts"),
  "utf8",
);

test("侧栏文件夹行：本地看 isFolder，内置笔记本看子页面", () => {
  expect(
    isSidebarFolderRow({
      isFolder: true,
      hasChildren: false,
      isLocalNotebook: true,
    }),
  ).toBe(true);
  expect(
    isSidebarFolderRow({
      isFolder: false,
      hasChildren: true,
      isLocalNotebook: true,
    }),
  ).toBe(false);
  expect(
    isSidebarFolderRow({
      isFolder: false,
      hasChildren: true,
      isLocalNotebook: false,
    }),
  ).toBe(true);
  expect(
    isSidebarFolderRow({
      isFolder: false,
      hasChildren: false,
      isLocalNotebook: false,
    }),
  ).toBe(false);
});

test("空文件夹占位：只在扫完后确实没有子项时出现", () => {
  const base = {
    isFolderRow: true,
    isExpanded: true,
    hasChildren: false,
    isLocalNotebook: true,
  };
  expect(
    shouldShowEmptyFolderPlaceholder({ ...base, localLoadStatus: "ready" }),
  ).toBe(true);
  expect(
    shouldShowEmptyFolderPlaceholder({ ...base, localLoadStatus: "idle" }),
  ).toBe(true);
  // 读取中/读取失败不能冒充空目录
  expect(
    shouldShowEmptyFolderPlaceholder({ ...base, localLoadStatus: "loading" }),
  ).toBe(false);
  expect(
    shouldShowEmptyFolderPlaceholder({ ...base, localLoadStatus: "error" }),
  ).toBe(false);
  // 折叠、有子项、不是文件夹行都不显示
  expect(
    shouldShowEmptyFolderPlaceholder({
      ...base,
      isExpanded: false,
      localLoadStatus: "ready",
    }),
  ).toBe(false);
  expect(
    shouldShowEmptyFolderPlaceholder({
      ...base,
      hasChildren: true,
      localLoadStatus: "ready",
    }),
  ).toBe(false);
  expect(
    shouldShowEmptyFolderPlaceholder({
      ...base,
      isFolderRow: false,
      localLoadStatus: "ready",
    }),
  ).toBe(false);
  // 内置笔记本没有本地扫描态，同样只在展开且无子项时显示
  expect(
    shouldShowEmptyFolderPlaceholder({
      isFolderRow: true,
      isExpanded: true,
      hasChildren: false,
      isLocalNotebook: false,
    }),
  ).toBe(true);
});

test("侧栏恢复文件图标，文件夹图标展开且 hover 不切换箭头", () => {
  for (const source of [mainTreeItem, treeRow]) {
    expect(source).toContain("<LocalFileIcon");
    expect(source).not.toContain('isFolderRow || page.localReadState === "error" ? (');
    expect(source).not.toContain("group-hover:opacity");
    expect(source).not.toContain("hideExpandArrows");
  }
  expect(mainTreeItem).toContain("const renderedIcon = (");
  expect(treeRow).not.toContain("ChevronRight");
  // 不恢复点击图标换图标的旧交互
  expect(mainTreeItem).not.toContain("IconSelector");
  expect(mainTreeItem).not.toContain("canCustomizePageIcon");
  expect(treeRow).not.toContain("IconSelector");
  // 文件夹图标点击 = 展开
  expect(mainTreeItem).toContain('aria-label={isExpanded ? "折叠子项" : "展开子项"}');
});

test("选中不残留边框，文本键盘焦点为中性色", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  expect(css).toContain("--goose-interactive-selected-border: transparent");
  expect(css).toContain("--goose-accent-focus: hsl(var(--muted-foreground))");
  const focus = readFileSync(resolve("src/styles/focus-reset.css"), "utf8");
  expect(focus).toContain('html[data-goose-pointer-focus="true"]');
});

test("空文件夹占位是渲染层产物，不进数据层也不参与拖拽", () => {
  expect(mainTreeItem).toContain("暂无文件");
  expect(mainTreeItem).toContain("shouldShowEmptyFolderPlaceholder");
  expect(treeAdapter).not.toContain("暂无文件");
  expect(treeAdapter).not.toContain("__placeholder");
});

test("文件夹右键菜单不再提供图标设置", () => {
  expect(sidebarContextMenu).not.toContain("IconSelector");
  expect(sidebarContextMenu).not.toContain("设置图标");
});
