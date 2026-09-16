import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  dropLineTopPx,
  findLastRowAboveY,
  findRowAtY,
  resolveLocalFolderDropParentId,
  shouldHideLocalFolderSortLine,
  type TreeRowDropInfo,
} from "../../src/pages/workspace/components/sidebar/main-tree/mainTreeDragGeometry";

function row(
  partial: Pick<TreeRowDropInfo, "id" | "isFolder" | "parentId"> & {
    top?: number;
    bottom?: number;
  },
): TreeRowDropInfo {
  const top = partial.top ?? 0;
  return {
    id: partial.id,
    isFolder: partial.isFolder,
    parentId: partial.parentId,
    top,
    bottom: partial.bottom ?? top + 32,
  };
}

test("本地文件夹：落在目录行上拖入该目录", () => {
  const folder = row({ id: "plan", isFolder: true, parentId: undefined, top: 0 });
  expect(resolveLocalFolderDropParentId(folder, null)).toBe("plan");
});

test("本地文件夹：落在文件行上拖入其所在目录", () => {
  const file = row({
    id: "guide",
    isFolder: false,
    parentId: "plan",
    top: 96,
  });
  expect(resolveLocalFolderDropParentId(file, null)).toBe("plan");
});

test("本地文件夹：拖到文件夹底部空白处仍拖入该文件夹", () => {
  const lastFile = row({
    id: "guide",
    isFolder: false,
    parentId: "plan",
    top: 160,
    bottom: 192,
  });
  expect(resolveLocalFolderDropParentId(null, lastFile)).toBe("plan");
});

test("本地文件夹：底部最后一行是目录时拖入该目录", () => {
  const lastFolder = row({
    id: "nested",
    isFolder: true,
    parentId: "plan",
    top: 160,
    bottom: 192,
  });
  expect(resolveLocalFolderDropParentId(null, lastFolder)).toBe("nested");
});

test("本地文件夹：树顶部空白拖到仓库根", () => {
  expect(resolveLocalFolderDropParentId(null, null)).toBeUndefined();
});

test("按指针 Y 命中行，超出列表则取上方最后一行", () => {
  const rows = [
    row({ id: "a", isFolder: true, parentId: undefined, top: 0, bottom: 32 }),
    row({ id: "b", isFolder: false, parentId: "a", top: 32, bottom: 64 }),
    row({ id: "c", isFolder: false, parentId: "a", top: 64, bottom: 96 }),
  ];
  expect(findRowAtY(rows, 40)?.id).toBe("b");
  expect(findRowAtY(rows, 96)).toBeNull();
  expect(findLastRowAboveY(rows, 120)?.id).toBe("c");
  expect(findLastRowAboveY(rows, -8)).toBeNull();
});

test("拖动线贴在真实行顶，最后一项之后贴行底", () => {
  expect(dropLineTopPx(0, [0, 32, 64], 32)).toBe(0);
  expect(dropLineTopPx(1, [0, 33, 67], 32)).toBe(33);
  expect(dropLineTopPx(3, [0, 33, 67], 34)).toBe(101);
  expect(dropLineTopPx(0, [], 32)).toBe(0);
});

test("本地文件夹只在同目录内拖动时显示排序线", () => {
  // 根级同目录内排序：显示
  expect(
    shouldHideLocalFolderSortLine({
      nestParent: "root",
      draggedParentId: undefined,
      isBetweenItems: true,
    }),
  ).toBe(false);
  // 目录内同目录排序：显示
  expect(
    shouldHideLocalFolderSortLine({
      nestParent: "plan",
      draggedParentId: "plan",
      isBetweenItems: true,
    }),
  ).toBe(false);
  // 落到别的目录：隐藏（只是移进该目录）
  expect(
    shouldHideLocalFolderSortLine({
      nestParent: "plan",
      draggedParentId: undefined,
      isBetweenItems: true,
    }),
  ).toBe(true);
  // 落在行上：隐藏
  expect(
    shouldHideLocalFolderSortLine({
      nestParent: "plan",
      draggedParentId: "plan",
      isBetweenItems: false,
    }),
  ).toBe(true);
});

test("主树用整数行高和真实落点，不再靠 mb-0.5 估高", () => {
  const item = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx",
    "utf8",
  );
  const tree = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx",
    "utf8",
  );
  const css = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/main-tree.css",
    "utf8",
  );
  expect(item).not.toMatch(/mb-0\.5/);
  expect(item).toContain("captureLocalFolderDropParent");
  expect(item).toContain("snapDragBetweenLine");
  expect(tree).toContain("--main-tree-row-height");
  expect(tree).toContain("takeLocalFolderDropParent");
  expect(tree).toContain("renderDepthOffset={MAIN_TREE_INDENT}");
  expect(css).toContain("--main-tree-row-height");
  expect(css).toContain("min-height: 100%");
  expect(css).toContain("main-tree-row--drop-target-local");
});
