import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import type { TabItem } from "../../src/stores/useTabs";
import {
  listVisibleWorkspaceTabs,
  shouldEditTitleInTab,
  shouldEditTitleInTabPill,
  findLoneVisibleWorkspaceTab,
  isReusableEmptyWorkspaceTab,
} from "../../src/pages/workspace/components/page/visibleTabs";

function page(id: string, extra: Partial<Page> = {}): Page {
  return { id, workspaceId: "nb", ...extra } as Page;
}

function getPageFrom(pages: Record<string, Page>) {
  return (id: string) => pages[id];
}

test("单个文档标签在 pill 上改名", () => {
  const pages = { a: page("a") };
  const tabs: TabItem[] = [{ id: "1", pageId: "a" }];
  const visible = listVisibleWorkspaceTabs(tabs, getPageFrom(pages), "nb");
  expect(shouldEditTitleInTabPill(visible)).toBe(true);
});

test("欢迎页单独打开时不在 pill 上改名", () => {
  const tabs: TabItem[] = [{ id: "w", pageId: "welcome", type: "welcome" }];
  const visible = listVisibleWorkspaceTabs(tabs, () => undefined, null);
  expect(visible).toHaveLength(1);
  expect(shouldEditTitleInTabPill(visible)).toBe(false);
});

test("两个文档标签不在 pill 上改名", () => {
  const pages = { a: page("a"), c: page("c") };
  const tabs: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "2", pageId: "c" },
  ];
  const visible = listVisibleWorkspaceTabs(tabs, getPageFrom(pages), "nb");
  expect(shouldEditTitleInTabPill(visible)).toBe(false);
});

test("多标签时新建的未落盘文件仍可在 pill 输入名称", () => {
  expect(shouldEditTitleInTab(page("new", { localUnsaved: true }), false)).toBe(true);
  expect(shouldEditTitleInTab(page("existing"), false)).toBe(false);
});

test("页面已从 store 消失的标签仍可见，方便关闭", () => {
  const pages = { a: page("a") };
  const tabs: TabItem[] = [
    { id: "1", pageId: "a", workspaceId: "nb" },
    { id: "gone", pageId: "missing", workspaceId: "nb" },
    { id: "other-gone", pageId: "other-missing", workspaceId: "other" },
  ];
  expect(
    listVisibleWorkspaceTabs(tabs, getPageFrom(pages), "nb").map((tab) => tab.id),
  ).toEqual(["1", "gone", "other-gone"]);
});

test("隐藏 notebook-ai 和回收站，保留其他笔记本的标签", () => {
  const pages = {
    a: page("a"),
    b: page("b", { trashedAt: 1 }),
    c: page("c", { workspaceId: "other" }),
  };
  const tabs: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "2", pageId: "b" },
    { id: "3", pageId: "c" },
    { id: "ai", pageId: "notebook-ai:nb", type: "notebook-ai" },
    { id: "4", pageId: "c" },
  ];
  const visible = listVisibleWorkspaceTabs(
    tabs,
    getPageFrom(pages),
    "nb",
  );
  expect(visible.map((tab) => tab.id)).toEqual(["1", "3", "4"]);
  expect(shouldEditTitleInTabPill(visible)).toBe(false);
});

test("其他笔记本的标签也计入可见数量", () => {
  const pages = { a: page("a"), c: page("c", { workspaceId: "other" }) };
  const tabs: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "2", pageId: "c" },
  ];
  const lone = findLoneVisibleWorkspaceTab(tabs, getPageFrom(pages), "nb");
  expect(lone).toBeNull();
});

test("已有欢迎页或第二个文档标签时不视为单独标签", () => {
  const pages = { a: page("a") };
  const withWelcome: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "w", pageId: "welcome", type: "welcome" },
  ];
  expect(
    findLoneVisibleWorkspaceTab(withWelcome, getPageFrom(pages), "nb"),
  ).toBeNull();

  const withTwo: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "2", pageId: "a" },
  ];
  expect(
    findLoneVisibleWorkspaceTab(withTwo, getPageFrom(pages), "nb"),
  ).toBeNull();
});

test("欢迎页和空白未落盘页可以填入，有内容或固定标签不行", () => {
  const pages = {
    empty: page("empty", {
      localUnsaved: true,
      content: [{ type: "paragraph", content: "" }],
    }),
    draft: page("draft", {
      localUnsaved: true,
      content: [{ type: "paragraph", content: "草稿" }],
    }),
    a: page("a"),
  };
  const getPage = getPageFrom(pages);
  expect(
    isReusableEmptyWorkspaceTab(
      { id: "w", pageId: "welcome", type: "welcome" },
      getPage,
    ),
  ).toBe(true);
  expect(
    isReusableEmptyWorkspaceTab({ id: "e", pageId: "empty" }, getPage),
  ).toBe(true);
  expect(
    isReusableEmptyWorkspaceTab({ id: "d", pageId: "draft" }, getPage),
  ).toBe(false);
  expect(
    isReusableEmptyWorkspaceTab({ id: "a", pageId: "a" }, getPage),
  ).toBe(false);
  expect(
    isReusableEmptyWorkspaceTab(
      { id: "p", pageId: "empty", pinned: true },
      getPage,
    ),
  ).toBe(false);
});

test("本地文件标题始终在标签页编辑，不在正文重复显示", () => {
  expect(
    shouldEditTitleInTab(page("local", { localFilePath: "/notes/a.md" }), false),
  ).toBe(true);
  expect(shouldEditTitleInTab(page("internal"), false)).toBe(false);
  expect(shouldEditTitleInTab(page("internal"), true)).toBe(true);
});
