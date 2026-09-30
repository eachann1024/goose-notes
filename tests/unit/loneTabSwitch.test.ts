import { expect, test } from "playwright/test";
import { createEmptyLocalPageContent } from "../../src/components/editor/utils/blocknote-content";
import { useEditorSplit } from "../../src/stores/useEditorSplit";
import { useFileNavHistory } from "../../src/stores/useFileNavHistory";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSettings } from "../../src/stores/useSettings";
import { useTabs } from "../../src/stores/useTabs";
import {
  discardPendingLocalSave,
  restorePendingLocalSave,
} from "../../src/stores/pages/folderSync";
import type { Page } from "../../src/types";

const notebookId = "lone-tab-notebook";

function makePage(id: string, extra?: Partial<Page>): Page {
  return {
    id,
    workspaceId: notebookId,
    content: [{ type: "paragraph", content: id }],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

test.beforeEach(() => {
  discardPendingLocalSave("a");
  useFileNavHistory.getState().reset();
  useEditorSplit.setState({ byTabId: {} });
  usePages.setState({
    pages: {
      a: makePage("a"),
      b: makePage("b"),
      c: makePage("c"),
    },
    activePageId: null,
    hydrated: true,
    dirtyLocalPageIds: {},
  });
  useNotebooks.setState({
    notebooks: {
      [notebookId]: {
        id: notebookId,
        name: "Lone",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: notebookId,
    lastActivePageByNotebook: {},
  });
  useTabs.setState({
    openTabs: [],
    activeTabId: null,
    tabHistory: [],
    tabHistoryIndex: -1,
    isHistoryNavigating: false,
    recentlyClosedPageIds: [],
  });
  useSettings.setState({ singleTabMode: false });
  const g = globalThis as typeof globalThis & { window?: object };
  if (typeof g.window !== "undefined" && g.window !== null) {
    const win = g.window;
    g.window = new Proxy(win, {
      get(target, prop, receiver) {
        if (prop === "dispatchEvent") return () => true;
        return Reflect.get(target, prop, receiver);
      },
    });
  }
});

test.afterEach(() => {
  discardPendingLocalSave("a");
});

test("普通导航复用当前标签，明确新开后只替换当前标签", async () => {
  useTabs.getState().openTab("a");
  await expect.poll(() => useTabs.getState().openTabs[0]?.pageId).toBe("a");
  const firstId = useTabs.getState().activeTabId;

  useTabs.getState().openPreviewTab("b");
  await expect.poll(() => useTabs.getState().openTabs[0]?.pageId).toBe("b");
  expect(useTabs.getState().openTabs).toHaveLength(1);
  expect(useTabs.getState().activeTabId).toBe(firstId);

  useTabs.getState().openPermanentTab("c");
  expect(useTabs.getState().openTabs.map((tab) => tab.pageId)).toEqual(["b", "c"]);
  useTabs.getState().openTab("a");
  await expect.poll(() => useTabs.getState().openTabs.map((tab) => tab.pageId)).toEqual(["b", "a"]);
  expect(useTabs.getState().openTabs[0].id).toBe(firstId);
});

test("置顶页面用正式标签打开，保留其他标签并复用已打开页面", () => {
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("b");
  const originalIds = useTabs.getState().openTabs.map((tab) => tab.id);

  useTabs.getState().openPermanentTab("c");
  useTabs.getState().openPermanentTab("a");

  const { openTabs, activeTabId } = useTabs.getState();
  expect(openTabs.map((tab) => tab.pageId)).toEqual(["a", "b", "c"]);
  expect(openTabs.slice(0, 2).map((tab) => tab.id)).toEqual(originalIds);
  expect(activeTabId).toBe(originalIds[0]);
  expect(openTabs.every((tab) => !tab.preview)).toBe(true);
});

test("只有一个有内容的标签时列表打开仍新增独立标签", () => {
  useTabs.getState().openPermanentTab("a");
  const firstId = useTabs.getState().openTabs[0]?.id;
  expect(firstId).toBeTruthy();

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "b"]);
  expect(tabs[0].id).toBe(firstId);
  expect(tabs[1].id).not.toBe(firstId);
  expect(useEditorSplit.getState().focusedPageId(firstId!)).toBe("a");
});

test("待确认恢复稿不会被误判为保存失败而阻止单标签切换", async () => {
  useSettings.setState({ singleTabMode: true });
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      a: makePage("a", { localFilePath: "/vault/a.md" }),
    },
    activePageId: "a",
    dirtyLocalPageIds: { a: true },
    flushPendingLocalSaveByPageId: async () => undefined,
  }));
  useTabs.setState({
    openTabs: [{ id: "tab-a", pageId: "a" }],
    activeTabId: "tab-a",
    tabHistory: ["tab-a"],
    tabHistoryIndex: 0,
  });
  restorePendingLocalSave("a", makePage("a").content, 1);

  useTabs.getState().openPreviewTab("b");

  await expect.poll(() => useTabs.getState().openTabs[0]?.pageId).toBe("b");
});

test("打开另一个标签后 focusedPageId 不会覆盖旧标签", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");

  useTabs.getState().openPreviewTab("c");

  const nextTabId = useTabs.getState().activeTabId!;
  expect(nextTabId).not.toBe(tabId);
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");
  expect(useEditorSplit.getState().focusedPageId(nextTabId)).toBe("c");
  expect(useTabs.getState().openTabs.map((tab) => tab.pageId)).toEqual(["a", "c"]);
});

test("欢迎页作为唯一标签时列表打开会填入该标签", () => {
  useTabs.getState().openWelcomeTab();
  const welcomeId = useTabs.getState().openTabs[0]?.id;
  expect(useTabs.getState().openTabs[0]?.type).toBe("welcome");

  useTabs.getState().openPreviewTab("a");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(1);
  expect(tabs[0].id).toBe(welcomeId);
  expect(tabs[0].pageId).toBe("a");
  expect(tabs[0].type).toBeUndefined();
});

test("手动唤出新标签后列表打开不会替换已有标签", () => {
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openWelcomeTab();
  expect(useTabs.getState().openTabs).toHaveLength(2);

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(2);
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "b"]);
  const preview = tabs.find((tab) => tab.pageId === "b");
  expect(preview?.preview).toBeFalsy();
});

test("跨笔记本切换和关闭多个标签后，已有标签不被替换", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      other: makePage("other", { workspaceId: "other-nb" }),
    },
  }));
  useTabs.getState().openPermanentTab("a");
  const lone = useTabs.getState().openTabs[0];
  expect(lone?.pageId).toBe("a");
  useTabs.setState({
    openTabs: [
      ...useTabs.getState().openTabs,
      {
        id: "tab-other",
        pageId: "other",
        workspaceId: "other-nb",
        lastAccessedAt: Date.now(),
      },
    ],
  });

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "other", "b"]);
  expect(tabs.find((tab) => tab.id === lone?.id)?.pageId).toBe("a");
  useTabs.getState().closeTab(lone!.id);
  useTabs.getState().openPreviewTab("a");
  expect(useTabs.getState().openTabs.map((tab) => tab.pageId)).toEqual(["other", "b", "a"]);
});

test("点加号得到空白未落盘标签后再打开页面会填入该标签", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      empty: makePage("empty", {
        localUnsaved: true,
        content: createEmptyLocalPageContent(),
      }),
    },
  }));
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("empty");
  const emptyTabId = useTabs.getState().activeTabId;
  expect(useTabs.getState().openTabs).toHaveLength(2);
  expect(emptyTabId).toBeTruthy();

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(2);
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "b"]);
  const filled = tabs.find((tab) => tab.id === emptyTabId);
  expect(filled?.pageId).toBe("b");
  expect(filled?.preview).toBeFalsy();
  expect(usePages.getState().getPage("empty")).toBeUndefined();
});

test("空白未落盘标签上永久打开也会填入而不是新增", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      empty: makePage("empty", {
        localUnsaved: true,
        content: createEmptyLocalPageContent(),
      }),
    },
  }));
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("empty");
  const emptyTabId = useTabs.getState().activeTabId;

  useTabs.getState().openPermanentTab("c");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(2);
  expect(tabs.find((tab) => tab.id === emptyTabId)?.pageId).toBe("c");
  expect(tabs.find((tab) => tab.id === emptyTabId)?.preview).toBeFalsy();
  expect(usePages.getState().getPage("empty")).toBeUndefined();
});

test("空标签不是当前活动标签时不抢着用", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      empty: makePage("empty", {
        localUnsaved: true,
        content: createEmptyLocalPageContent(),
      }),
    },
  }));
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("empty");
  const aTab = useTabs.getState().openTabs.find((tab) => tab.pageId === "a");
  expect(aTab).toBeTruthy();
  useTabs.getState().setActiveTab(aTab!.id);

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(3);
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "empty", "b"]);
});

test("已有内容的未落盘草稿不会被打开页面替换", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      draft: makePage("draft", {
        localUnsaved: true,
        content: [{ type: "paragraph", content: "草稿" }],
      }),
    },
  }));
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("draft");

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(3);
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "draft", "b"]);
  expect(usePages.getState().getPage("draft")).toBeTruthy();
});
