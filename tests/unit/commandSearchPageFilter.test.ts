import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { isCommandSearchablePage } from "../../src/pages/workspace/components/command/searchPageFilter";

const pageBase: Page = {
  id: "page-1",
  workspaceId: "notebook-1",
  content: [
    { type: "heading", props: { level: 1 }, content: "测试页面" },
  ],
  isLocked: false,
  fontSize: "default",
  fontFamily: "default",
  createdAt: 1,
  updatedAt: 1,
};

test("本地文件夹的目录节点不进入搜索，但文件仍可搜索", () => {
  const notebooks = {
    "notebook-1": { source: "local-folder" as const },
  };

  expect(
    isCommandSearchablePage({ ...pageBase, isFolder: true }, notebooks),
  ).toBe(false);
  expect(
    isCommandSearchablePage(
      { ...pageBase, isFolder: false, localFilePath: "/notes/test.md" },
      notebooks,
    ),
  ).toBe(true);
});

test("内置记事本的父页面仍属于可搜索页面", () => {
  expect(
    isCommandSearchablePage(
      { ...pageBase, isFolder: true },
      { "notebook-1": { source: "default" } },
    ),
  ).toBe(true);
});
