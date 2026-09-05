import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  closePaneOrTab,
  focusNeighbor,
  splitRight,
  toggleZoom,
  tryShowPageInFocusedSplit,
} from "../../src/lib/editor-split/commands";
import { walkLeaves } from "../../src/lib/editor-split/tree";
import {
  applyPersistedTabSplit,
  editorSplitPersistKey,
  useEditorSplit,
  writeTabSplitForWindow,
} from "../../src/stores/useEditorSplit";
import { useFileNavHistory } from "../../src/stores/useFileNavHistory";
import { useHistoryView } from "../../src/stores/useHistoryView";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSettings } from "../../src/stores/useSettings";
import { useTabs } from "../../src/stores/useTabs";
import type { Page } from "../../src/types";

const notebookId = "split-tabs-notebook";

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

function stubWindowDispatch() {
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
}

function resetStores() {
  stubWindowDispatch();
  useFileNavHistory.getState().reset();
  useHistoryView.setState({
    active: null,
    selectedVersionId: null,
    refreshTick: 0,
  });
  useEditorSplit.setState({ byTabId: {} });
  usePages.setState({
    pages: {
      a: makePage("a"),
      b: makePage("b"),
      c: makePage("c"),
      d: makePage("d"),
    },
    activePageId: "a",
    hydrated: true,
    dirtyLocalPageIds: {},
  });
  useNotebooks.setState({
    notebooks: {
      [notebookId]: {
        id: notebookId,
        name: "Split",
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
}

function installFlushSpy() {
  const flushed: string[] = [];
  usePages.setState({
    flushPendingLocalSaveByPageId: async (pageId: string) => {
      flushed.push(pageId);
    },
  });
  return flushed;
}

function splitTab(tabId: string, newPageId: string) {
  useEditorSplit.getState().ensureTab(tabId, useTabs.getState().openTabs.find((tab) => tab.id === tabId)?.pageId ?? "a");
  const result = useEditorSplit.getState().splitFocused({
    tabId,
    direction: "right",
    newPageId,
  });
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  return result;
}

test.beforeEach(() => {
  resetStores();
});

test("关 Tab 会 flush 全部分屏叶 pageId", () => {
  const flushed = installFlushSpy();
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId;
  expect(tabId).toBeTruthy();
  splitTab(tabId!, "b");
  useTabs.getState().syncTabPageId(tabId!, "b");

  useTabs.getState().closeTab(tabId!);

  expect([...flushed].sort()).toEqual(["a", "b"]);
});

test("closeOtherTabs 会 flush 被关 tab 的分屏叶", () => {
  const flushed = installFlushSpy();
  useTabs.getState().openPermanentTab("a");
  const tabA = useTabs.getState().activeTabId!;
  splitTab(tabA, "b");
  useTabs.getState().syncTabPageId(tabA, "b");
  useTabs.getState().openPermanentTab("c");
  const tabC = useTabs.getState().activeTabId!;
  expect(tabC).not.toBe(tabA);

  useTabs.getState().closeOtherTabs(tabC);

  expect(flushed).toContain("a");
  expect(flushed).toContain("b");
  expect(flushed).not.toContain("c");
});

test("openPermanentTab 命中其他 tab 的分屏叶时切 tab 并 focus 该叶", () => {
  useTabs.getState().openPermanentTab("a");
  const tabA = useTabs.getState().activeTabId!;
  splitTab(tabA, "b");
  useTabs.getState().syncTabPageId(tabA, "b");
  useTabs.getState().openPermanentTab("c");
  expect(useTabs.getState().activeTabId).not.toBe(tabA);

  useTabs.getState().openPermanentTab("a");

  expect(useTabs.getState().activeTabId).toBe(tabA);
  expect(useEditorSplit.getState().focusedPageId(tabA)).toBe("a");
  const leaf = walkLeaves(
    useEditorSplit.getState().getStateForTab(tabA)!.root,
  ).find((item) => item.pageId === "a");
  expect(leaf?.id).toBe(
    useEditorSplit.getState().getStateForTab(tabA)?.focusedLeafId,
  );
});

test("tryShowPageInFocusedSplit 先激活已展示该页的分屏 tab，不改当前格", () => {
  useTabs.getState().openPermanentTab("a");
  const tabA = useTabs.getState().activeTabId!;
  splitTab(tabA, "b");
  useTabs.getState().syncTabPageId(tabA, "b");
  useTabs.getState().openPermanentTab("c");
  const tabC = useTabs.getState().activeTabId!;
  splitTab(tabC, "d");

  const shown = tryShowPageInFocusedSplit("a");
  expect(shown).toBe(true);
  expect(useTabs.getState().activeTabId).toBe(tabA);
  expect(useEditorSplit.getState().focusedPageId(tabA)).toBe("a");
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabC)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["c", "d"]);
});

test("关格前 flush 当前聚焦页，有内容的 unsaved 不丢弃", () => {
  const flushed = installFlushSpy();
  usePages.setState({
    pages: {
      ...usePages.getState().pages,
      draft: makePage("draft", {
        localUnsaved: true,
        content: [{ type: "paragraph", content: "已写过" }],
      }),
    },
  });
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "draft");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("draft");

  const result = closePaneOrTab();
  expect(result).toBe("closed-pane");
  expect(flushed).toContain("draft");
  expect(usePages.getState().getPage("draft")).toBeTruthy();
  expect(useEditorSplit.getState().isSplit(tabId)).toBe(false);
});

test("关格会丢弃空 unsaved，不 flush", () => {
  const flushed = installFlushSpy();
  usePages.setState({
    pages: {
      ...usePages.getState().pages,
      empty: makePage("empty", {
        localUnsaved: true,
        content: [{ type: "paragraph", content: "" }],
      }),
    },
  });
  const originalDiscard = usePages.getState().discardUnsavedLocalPage;
  const discarded: string[] = [];
  usePages.setState({
    discardUnsavedLocalPage: (pageId: string) => {
      discarded.push(pageId);
      originalDiscard(pageId);
    },
  });
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "empty");

  expect(closePaneOrTab()).toBe("closed-pane");
  expect(flushed).not.toContain("empty");
  expect(discarded).toContain("empty");
});

test("历史预览时 split/close/focus/zoom 不改 store", async () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  const before = structuredClone(useEditorSplit.getState().byTabId);
  useHistoryView.setState({ active: "b" });
  usePages.setState({ activePageId: "b" });

  expect(await splitRight()).toBe(false);
  expect(closePaneOrTab()).toBe("close-tab");
  expect(focusNeighbor("left")).toBeNull();
  toggleZoom();

  expect(useEditorSplit.getState().byTabId).toEqual(before);
});

test("releaseTab 会 flush 全部分屏叶并 clearTab", () => {
  const flushed = installFlushSpy();
  useTabs.getState().openPermanentTab("a");
  const tabA = useTabs.getState().activeTabId!;
  splitTab(tabA, "b");
  useTabs.getState().syncTabPageId(tabA, "b");
  useTabs.getState().openPermanentTab("c");

  const moved = useTabs.getState().releaseTab(tabA);
  expect(moved.emptied).toBe(false);
  expect([...flushed].sort()).toEqual(["a", "b"]);
  expect(useEditorSplit.getState().getStateForTab(tabA)).toBeNull();
  expect(useTabs.getState().recentlyClosedPageIds).toEqual([]);
});

test("分屏视觉是独立卡片，sash 不画纸缝线", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-split.css", import.meta.url),
    "utf8",
  );
  const layout = readFileSync(
    new URL("../../src/pages/workspace/WorkspaceLayout.tsx", import.meta.url),
    "utf8",
  );
  expect(css).toContain('data-editor-split="true"');
  expect(css).toContain("border-radius: 12px");
  expect(css).toContain("var(--goose-interactive-selected)");
  expect(css).toContain("background: transparent");
  expect(css).not.toContain("blue-500");
  expect(layout).toContain('data-editor-split={isSplit ? "true" : undefined}');
  expect(layout).toContain("!isSplit &&");
});

test("splitInDirection 在建新页后把未分屏左叶钉回源页", () => {
  const source = readFileSync(
    new URL("../../src/lib/editor-split/commands.ts", import.meta.url),
    "utf8",
  );
  expect(source).toContain("createSplitBlankPage");
  expect(source).toContain("if (!split.isSplit(tab.id))");
  expect(source).toContain("split.ensureTab(tab.id, sourcePageId)");
  expect(source).not.toContain("didFallbackToDown");
  expect(source).not.toContain("已改为向下分屏");
});

test("打开 tab 时 store 会 ensureTab", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  expect(useEditorSplit.getState().getStateForTab(tabId)?.root).toEqual(
    expect.objectContaining({ kind: "leaf", pageId: "a" }),
  );
});

test("createPage 改 activePage 后分屏前会钉回左叶", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  useEditorSplit.getState().ensureTab(tabId, "a");
  usePages.setState({ activePageId: "b" });
  useEditorSplit.getState().ensureTab(tabId, "b");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("b");

  useEditorSplit.getState().ensureTab(tabId, "a");
  const result = useEditorSplit.getState().splitFocused({
    tabId,
    direction: "right",
    newPageId: "c",
  });
  expect(result.ok).toBe(true);
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabId)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["a", "c"]);
});

test("ensureTab 未分屏时同步叶子，已分屏不改树", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  useEditorSplit.getState().ensureTab(tabId, "b");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("b");

  splitTab(tabId, "c");
  const before = structuredClone(useEditorSplit.getState().byTabId);
  useEditorSplit.getState().ensureTab(tabId, "a");
  expect(useEditorSplit.getState().byTabId).toEqual(before);
});

test("撕窗 persist 可把分屏树交给目标窗", () => {
  const g = globalThis as typeof globalThis & {
    window?: {
      localStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
      dispatchEvent?: (event: Event) => boolean;
    };
  };
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  const previousWindow = g.window;
  const previousDispatch = previousWindow?.dispatchEvent;
  g.window = {
    ...previousWindow,
    localStorage,
    dispatchEvent: previousDispatch ?? (() => true),
  };

  try {
    useTabs.getState().openPermanentTab("a");
    const tabId = useTabs.getState().activeTabId!;
    splitTab(tabId, "b");
    const tree = useEditorSplit.getState().getStateForTab(tabId);
    expect(tree).toBeTruthy();

    const destWindowId = "tear-off-dest";
    writeTabSplitForWindow(destWindowId, tabId, tree!);
    expect(memory.get(editorSplitPersistKey(destWindowId))).toContain(tabId);

    useEditorSplit.setState({ byTabId: {} });
    useEditorSplit.getState().ensureTab(tabId, "a");
    expect(useEditorSplit.getState().isSplit(tabId)).toBe(false);

    expect(applyPersistedTabSplit(tabId, destWindowId)).toBe(true);
    expect(useEditorSplit.getState().isSplit(tabId)).toBe(true);
    expect(
      walkLeaves(useEditorSplit.getState().getStateForTab(tabId)!.root).map(
        (leaf) => leaf.pageId,
      ),
    ).toEqual(["a", "b"]);
  } finally {
    g.window = previousWindow;
  }
});
