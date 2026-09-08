import { expect, test } from "playwright/test";
import { createEmptyLocalPageContent } from "../../src/components/editor/utils/blocknote-content";
import { useEditorSplit } from "../../src/stores/useEditorSplit";
import { useFileNavHistory } from "../../src/stores/useFileNavHistory";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSettings } from "../../src/stores/useSettings";
import { useTabs } from "../../src/stores/useTabs";
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

test("只有一个标签时列表打开是切换而不是新增", () => {
  useTabs.getState().openPermanentTab("a");
  const firstId = useTabs.getState().openTabs[0]?.id;
  expect(firstId).toBeTruthy();

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(1);
  expect(tabs[0].id).toBe(firstId);
  expect(tabs[0].pageId).toBe("b");
  expect(tabs[0].preview).toBeFalsy();
  expect(useEditorSplit.getState().focusedPageId(firstId!)).toBe("b");
});

test("单标签切页后 focusedPageId 跟着换，不会被布局回写旧页", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");

  useTabs.getState().openPreviewTab("c");

  const focused = useEditorSplit.getState().focusedPageId(tabId);
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("c");
  expect(focused).toBe("c");
  if (focused && focused !== usePages.getState().activePageId) {
    void usePages.getState().setActivePage(focused);
  }
  useTabs.getState().syncTabPageId(tabId, focused!);
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("c");
  expect(usePages.getState().activePageId).toBe("c");
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

test("手动唤出新标签后列表打开才走预览新标签", () => {
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openWelcomeTab();
  expect(useTabs.getState().openTabs).toHaveLength(2);

  useTabs.getState().openPreviewTab("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(2);
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "b"]);
  const preview = tabs.find((tab) => tab.pageId === "b");
  expect(preview?.preview).toBe(true);
});

test("其他笔记本的隐藏标签不阻止当前笔记本单标签切换", () => {
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
  expect(tabs.find((tab) => tab.pageId === "a")).toBeUndefined();
  expect(tabs.find((tab) => tab.id === lone?.id)?.pageId).toBe("b");
  expect(tabs.find((tab) => tab.pageId === "other")).toBeTruthy();
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
  expect(filled?.preview).toBe(true);
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
