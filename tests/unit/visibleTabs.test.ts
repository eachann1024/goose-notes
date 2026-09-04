import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import type { TabItem } from "../../src/stores/useTabs";
import {
  listVisibleWorkspaceTabs,
  shouldEditTitleInTabPill,
  findLoneVisibleWorkspaceTab,
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

test("隐藏 notebook-ai、回收站和其他笔记本的标签", () => {
  const pages = {
    a: page("a"),
    trash: page("b", { trashedAt: 1 }),
    other: page("c", { workspaceId: "other" }),
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
  expect(visible.map((tab) => tab.id)).toEqual(["1"]);
  expect(shouldEditTitleInTabPill(visible)).toBe(true);
});

test("当前笔记本只有一个可见标签时返回该标签", () => {
  const pages = { a: page("a"), other: page("c", { workspaceId: "other" }) };
  const tabs: TabItem[] = [
    { id: "1", pageId: "a" },
    { id: "2", pageId: "c" },
  ];
  const lone = findLoneVisibleWorkspaceTab(tabs, getPageFrom(pages), "nb");
  expect(lone?.id).toBe("1");
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

test("正文大标题只在多个文档标签时显示", () => {
  const composer = readFileSync(
    new URL("../../src/components/editor/core/EditorComposer.tsx", import.meta.url),
    "utf8",
  );
  const host = readFileSync(
    new URL(
      "../../src/pages/workspace/components/editor-host/EditorHostBridge.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(composer).toContain("showLocalFileTitle");
  expect(composer).toContain("page?.localFilePath && showLocalFileTitle");
  expect(host).toContain("showLocalFileTitle");
  expect(host).toContain("shouldEditTitleInTabPill");
});
