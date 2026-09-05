import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { pagesToTreeItems } from "../../src/pages/workspace/components/sidebar/main-tree/treeAdapter";
import { buildVisibleTree } from "../../src/pages/workspace/components/sidebar/tree-dnd";

function page(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    workspaceId: "nb",
    content: { type: "doc", content: [] },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test("pagesToTreeItems 按待创建、order/createdAt、id 排序且不修改输入", () => {
  const pages = [
    page("b", { order: 2 }),
    page("late", { createdAt: 3 }),
    page("a", { order: 2 }),
    page("early", { createdAt: 0 }),
    page("pending", { localPendingCreate: "file", order: 99 }),
    page("child-b", { parentId: "a", order: 2 }),
    page("child-a", { parentId: "a", order: 1 }),
    page("trashed", { trashedAt: 1 }),
    page("unsaved", { localUnsaved: true }),
    page("other", { workspaceId: "other" }),
  ];
  const before = structuredClone(pages);
  Object.freeze(pages);
  pages.forEach(Object.freeze);

  const items = pagesToTreeItems(pages, "nb", false);

  expect(items.root.children).toEqual(["pending", "early", "a", "b", "late"]);
  expect(items.a.children).toEqual(["child-a", "child-b"]);
  expect(Object.keys(items).sort()).toEqual([
    "a", "b", "child-a", "child-b", "early", "late", "pending", "root",
  ]);
  expect(items.b.data).toBe(pages[0]);
  expect(items.pending.canMove).toBe(false);
  expect(pages).toEqual(before);
});

test("pagesToTreeItems 本地目录待创建优先、文件夹优先、名称自然排序", () => {
  const pages = [
    page("file-10", { localFilePath: "/notes/10.md" }),
    page("folder-10", { isFolder: true, localFilePath: "/notes/10" }),
    page("file-2", { localFilePath: "/notes/2.md" }),
    page("folder-2", { isFolder: true, localFilePath: "/notes/2" }),
    page("pending", { localPendingCreate: "file", localFilePath: "/notes/99.md" }),
  ];
  const before = structuredClone(pages);

  const items = pagesToTreeItems(pages, "nb", true);

  expect(items.root.children).toEqual([
    "pending", "folder-2", "folder-10", "file-2", "file-10",
  ]);
  expect(pages).toEqual(before);
});

test("buildVisibleTree flat roots 保留指定顺序、去重与过滤，不展开子树", () => {
  const list = [
    page("a", { order: 1 }),
    page("b", { order: 2 }),
    page("child", { parentId: "a" }),
    page("trashed", { trashedAt: 1 }),
    page("other", { workspaceId: "other" }),
  ];
  const pages = Object.fromEntries(list.map((item) => [item.id, item]));
  const before = structuredClone(pages);
  const rootPageIds = ["b", "missing", "trashed", "other", "child", "a", "b"];
  const rootsBefore = [...rootPageIds];
  const openIds = new Set(["a", "b", "child"]);

  const visible = buildVisibleTree({
    pages, openIds, workspaceId: "nb", isLocalNotebook: false,
    rootPageIds, flatRoots: true,
  });

  expect(visible).toEqual(["b", "child", "a"].map((id) => ({
    id, page: pages[id], depth: 0, parentId: undefined,
    hasChildren: false, isOpen: false,
  })));
  expect(pages).toEqual(before);
  expect(rootPageIds).toEqual(rootsBefore);
  expect([...openIds]).toEqual(["a", "b", "child"]);
});

test("buildVisibleTree flat roots 空数组和未指定根均回退到排序后的顶层", () => {
  const pages = {
    b: page("b", { order: 2 }),
    a: page("a", { order: 1 }),
    child: page("child", { parentId: "a" }),
    trashed: page("trashed", { trashedAt: 1 }),
    other: page("other", { workspaceId: "other" }),
  };
  for (const rootPageIds of [[], undefined]) {
    const visible = buildVisibleTree({
      pages, openIds: new Set(["a"]), workspaceId: "nb",
      isLocalNotebook: false, rootPageIds, flatRoots: true,
    });
    expect(visible.map((item) => item.id)).toEqual(["a", "b"]);
  }
});

test("buildVisibleTree 非 flat roots 的指定根仍展开排序后的子节点", () => {
  const visible = buildVisibleTree({
    pages: {
      root: page("root"),
      b: page("b", { parentId: "root", order: 2 }),
      a: page("a", { parentId: "root", order: 1 }),
    },
    openIds: new Set(["root"]),
    workspaceId: "nb",
    isLocalNotebook: false,
    rootPageIds: ["root"],
    flatRoots: false,
  });
  expect(visible.map((item) => [item.id, item.depth])).toEqual([
    ["root", 0], ["a", 1], ["b", 1],
  ]);
});
