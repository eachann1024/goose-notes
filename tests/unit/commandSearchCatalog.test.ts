import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import {
  filterCatalogByScope,
  getSearchCatalog,
  resetSearchCatalog,
  syncSearchCatalog,
} from "../../src/pages/workspace/components/command/pageSearchCatalog";
import {
  resetIndex,
  searchIndex,
} from "../../src/pages/workspace/components/command/pageSearchIndex";

function pageWithTitle(id: string, title: string, extras: Partial<Page> = {}): Page {
  return {
    id,
    workspaceId: "notebook-1",
    content: [
      { type: "heading", props: { level: 1 }, content: title },
    ],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: extras.updatedAt ?? 1,
    ...extras,
  };
}

test.afterEach(() => {
  resetSearchCatalog();
  resetIndex();
});

test("空 pages 快照不会清掉已预热的搜索目录和索引", () => {
  const pages = {
    "page-b": pageWithTitle("page-b", "采购"),
    "page-a": pageWithTitle("page-a", "安排"),
  };
  const notebooks = { "notebook-1": { source: "default" as const } };

  syncSearchCatalog(pages, notebooks);
  expect(getSearchCatalog().sortedByTitle.map((page) => page.id)).toEqual([
    "page-a",
    "page-b",
  ]);
  expect(searchIndex("采购")).toContain("page-b");

  const afterEmpty = syncSearchCatalog({}, notebooks);
  expect(afterEmpty.sortedByTitle.map((page) => page.id)).toEqual([
    "page-a",
    "page-b",
  ]);
  expect(searchIndex("采购")).toContain("page-b");
});

test("同一 pages 引用再次 sync 时不重建目录", () => {
  const pages = {
    "page-a": pageWithTitle("page-a", "安排"),
  };
  const notebooks = { "notebook-1": { source: "default" as const } };
  const first = syncSearchCatalog(pages, notebooks);
  const second = syncSearchCatalog(pages, notebooks);
  expect(second).toBe(first);
});

test("当前记事本范围过滤保持标题排序", () => {
  const pages = {
    "page-2": pageWithTitle("page-2", "账单", { workspaceId: "notebook-1" }),
    "page-1": pageWithTitle("page-1", "安排", { workspaceId: "notebook-1" }),
    "page-other": pageWithTitle("page-other", "啊啊", {
      workspaceId: "notebook-2",
    }),
  };
  const notebooks = {
    "notebook-1": { source: "default" as const },
    "notebook-2": { source: "default" as const },
  };
  const catalog = syncSearchCatalog(pages, notebooks);
  const scoped = filterCatalogByScope(
    catalog.sortedByTitle,
    notebooks,
    false,
    "notebook-1",
  );
  expect(scoped.map((page) => page.id)).toEqual(["page-1", "page-2"]);
});

test("所有记事本范围始终包含当前本，即使当前本排除了全局搜索", () => {
  const pages = {
    "page-current": pageWithTitle("page-current", "页面1", {
      workspaceId: "notebook-a",
    }),
    "page-other": pageWithTitle("page-other", "页面2", {
      workspaceId: "notebook-b",
    }),
    "page-hidden": pageWithTitle("page-hidden", "页面3", {
      workspaceId: "notebook-c",
    }),
  };
  const notebooks = {
    "notebook-a": {
      source: "default" as const,
      excludeFromGlobalSearch: true,
    },
    "notebook-b": { source: "default" as const },
    "notebook-c": {
      source: "default" as const,
      excludeFromGlobalSearch: true,
    },
  };
  const catalog = syncSearchCatalog(pages, notebooks);
  const allScoped = filterCatalogByScope(
    catalog.sortedByTitle,
    notebooks,
    true,
    "notebook-a",
  );
  expect(allScoped.map((page) => page.id).sort()).toEqual([
    "page-current",
    "page-other",
  ]);
});
