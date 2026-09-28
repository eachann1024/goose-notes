import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAIN_TREE_INDENT,
  MAIN_TREE_ROW_PADDING_LEFT,
} from "../../src/pages/workspace/components/sidebar/main-tree/mainTreeDragGeometry";
import { TREE_INDENT } from "../../src/pages/workspace/components/sidebar/tree/useTreeDnd";

const mainTreeItem = readFileSync(
  new URL("../../src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx", import.meta.url),
  "utf8",
);
const layoutCss = readFileSync(
  new URL("../../src/pages/workspace/components/sidebar/sidebar-layout.css", import.meta.url),
  "utf8",
);
assert.match(mainTreeItem, /main-tree-row-icon-group pointer-events-none/);
assert.match(mainTreeItem, /style=\{\{ width: isFolderRow \? INDENT \* 2 : INDENT, height: INDENT \}\}/);
assert.match(mainTreeItem, /className="ml-0 rounded-md pointer-events-auto"/);
assert.match(mainTreeItem, /style: \{ width: INDENT, height: INDENT \}/);
assert.match(mainTreeItem, /main-tree-row-icon-slot pointer-events-none/);
assert.match(layoutCss, /\.sidebar-design \.main-tree-row-icon-group :is\(\.main-tree-row-icon-slot, \.main-tree-row-disclosure, \.main-tree-row-disclosure-placeholder\)/);
assert.match(layoutCss, /\.main-tree-row-icon-group \.main-tree-row-disclosure::before \{[^}]*inset: -3px/);

const rowStart = (depth: number, indent: number) =>
  depth * indent + MAIN_TREE_ROW_PADDING_LEFT + 4;

for (let depth = 0; depth < 5; depth += 1) {
  const mainFolderIcon = rowStart(depth, MAIN_TREE_INDENT) + MAIN_TREE_INDENT;
  const mainChildFileIcon = rowStart(depth + 1, MAIN_TREE_INDENT);
  assert.equal(mainFolderIcon, mainChildFileIcon, `主树深度 ${depth}`);

  const favoriteFolderIcon = rowStart(depth, TREE_INDENT) + TREE_INDENT;
  const favoriteChildFileIcon = rowStart(depth + 1, TREE_INDENT);
  assert.equal(favoriteFolderIcon, favoriteChildFileIcon, `收藏树深度 ${depth}`);
}

console.log("主树与收藏树的父文件夹图标、直接子文件图标水平坐标一致。");
