import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  closePaneOrTab,
  focusNeighbor,
  focusNextSplitPane,
  focusPreviousSplitPane,
  focusSplitPane,
  splitRight,
  toggleZoom,
  tryShowPageInFocusedSplit,
} from "../../src/lib/editor-split/commands";
import { walkLeaves } from "../../src/lib/editor-split/tree";
import { activateNotebook } from "../../src/lib/notebookNavigation";
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
const otherNotebookId = "split-tabs-other-notebook";

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
      other: makePage("other", { workspaceId: otherNotebookId }),
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
      [otherNotebookId]: {
        id: otherNotebookId,
        name: "Other",
        source: "local-folder",
        localPath: "/split-tabs-other",
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

test("分屏内打开已在其他标签展示的页仍替换发起时聚焦格", () => {
  useTabs.getState().openPermanentTab("a");
  const tabA = useTabs.getState().activeTabId!;
  splitTab(tabA, "b");
  useTabs.getState().syncTabPageId(tabA, "b");
  useTabs.getState().openPermanentTab("c");
  const tabC = useTabs.getState().activeTabId!;
  splitTab(tabC, "d");

  const shown = tryShowPageInFocusedSplit("a");
  expect(shown).toBe(true);
  expect(useTabs.getState().activeTabId).toBe(tabC);
  expect(useEditorSplit.getState().focusedPageId(tabC)).toBe("a");
  expect(
    useTabs.getState().openTabs.find((tab) => tab.id === tabC)?.pageId,
  ).toBe("a");
  expect(usePages.getState().activePageId).toBe("a");
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabA)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["a", "b"]);
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabC)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["c", "a"]);
});

test("分屏内选择新页面只替换聚焦格，并同步标签和活动页", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  useTabs.getState().syncTabPageId(tabId, "b");

  const shown = tryShowPageInFocusedSplit("c");

  expect(shown).toBe(true);
  expect(useTabs.getState().openTabs).toHaveLength(1);
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabId)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["a", "c"]);
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("c");
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("c");
  expect(usePages.getState().activePageId).toBe("c");
});

test("跨本地记事本的分屏导航保留目标叶并登记异步重扫目标", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  const activePageTransitions: Array<string | null> = [];
  const unsubscribe = usePages.subscribe((state) => {
    activePageTransitions.push(state.activePageId);
  });

  let shown: boolean;
  try {
    shown = tryShowPageInFocusedSplit("other");
  } finally {
    unsubscribe();
  }

  expect(shown).toBe(true);
  expect(useTabs.getState().openTabs).toHaveLength(1);
  expect(useTabs.getState().activeTabId).toBe(tabId);
  expect(
    walkLeaves(useEditorSplit.getState().getStateForTab(tabId)!.root).map(
      (leaf) => leaf.pageId,
    ),
  ).toEqual(["a", "other"]);
  expect(useNotebooks.getState().activeNotebookId).toBe(otherNotebookId);
  expect(usePages.getState().activePageId).toBe("other");
  expect(activePageTransitions).not.toContain(null);
});

test("没有明确目标时切入本地记事本仍进入首次加载空态", () => {
  useNotebooks.getState().setActiveNotebook(otherNotebookId);

  expect(usePages.getState().activePageId).toBeNull();
});

test("普通侧栏切入已加载本地记事本会复用上次缓存页且不经过空态", () => {
  useNotebooks.getState().setLastActivePage(otherNotebookId, "other");
  const activePageTransitions: Array<string | null> = [];
  const unsubscribe = usePages.subscribe((state) => {
    activePageTransitions.push(state.activePageId);
  });

  try {
    useNotebooks.getState().setActiveNotebook(otherNotebookId);
  } finally {
    unsubscribe();
  }

  expect(usePages.getState().activePageId).toBe("other");
  expect(activePageTransitions).not.toContain(null);
});

test("侧栏 activateNotebook 不会把本地缓存落点再次清回空态", async () => {
  useNotebooks.getState().setLastActivePage(otherNotebookId, "other");
  const activePageTransitions: Array<string | null> = [];
  const unsubscribe = usePages.subscribe((state) => {
    activePageTransitions.push(state.activePageId);
  });

  try {
    await activateNotebook(otherNotebookId);
  } finally {
    unsubscribe();
  }

  expect(usePages.getState().activePageId).toBe("other");
  expect(activePageTransitions).not.toContain(null);
});

test("新建本地文件夹在扫描完成前不会继续显示旧记事本页面", () => {
  const activePageTransitions: Array<string | null> = [];
  const unsubscribe = usePages.subscribe((state) => {
    activePageTransitions.push(state.activePageId);
  });

  try {
    useNotebooks
      .getState()
      .createLocalFolderNotebook("New local", "/split-tabs-new-local");
  } finally {
    unsubscribe();
  }

  expect(usePages.getState().activePageId).toBeNull();
  expect(activePageTransitions.at(-1)).toBeNull();
});

test("重新打开已登记的本地文件夹会复用其缓存落点", () => {
  useNotebooks.getState().setLastActivePage(otherNotebookId, "other");
  const activePageTransitions: Array<string | null> = [];
  const unsubscribe = usePages.subscribe((state) => {
    activePageTransitions.push(state.activePageId);
  });

  try {
    const id = useNotebooks
      .getState()
      .createLocalFolderNotebook("Other", "/split-tabs-other");
    expect(id).toBe(otherNotebookId);
  } finally {
    unsubscribe();
  }

  expect(usePages.getState().activePageId).toBe("other");
  expect(activePageTransitions).not.toContain(null);
});

test("同一本地记事本的后续分屏导航会覆盖迟到扫描的旧 pending 目标", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  useNotebooks.setState({
    activeNotebookId: otherNotebookId,
    localFolderLoadStates: { [otherNotebookId]: { status: "loading" } },
  });
  usePages.getState().setPendingNavigatePageId("a");

  expect(tryShowPageInFocusedSplit("other")).toBe(true);

  expect(usePages.getState().pendingNavigatePageId).toBe("other");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("other");
});

test("扫描期间已保存的本地正文不会被迟到扫描的旧磁盘内容覆盖", async () => {
  const pageId = `local-${otherNotebookId}-target.md`;
  const initialContent = [{ type: "paragraph", content: "扫描开始时的正文" }];
  const savedContent = [{ type: "paragraph", content: "扫描期间已保存的正文" }];
  usePages.setState({
    pages: {
      ...usePages.getState().pages,
      [pageId]: makePage(pageId, {
        workspaceId: otherNotebookId,
        content: initialContent,
        localFilePath: "/split-tabs-other/old-target.md",
      }),
    },
    dirtyLocalPageIds: {},
  });
  useNotebooks.setState({ activeNotebookId: otherNotebookId });

  const g = globalThis as typeof globalThis & { window?: Window };
  const previousWindow = g.window;
  const memory = new Map<string, string>();
  g.window = {
    dispatchEvent: () => true,
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  } as unknown as Window;
  let releaseScan!: () => void;
  const scanGate = new Promise<void>((resolve) => {
    releaseScan = resolve;
  });
  let signalScanStarted!: () => void;
  const scanStarted = new Promise<void>((resolve) => {
    signalScanStarted = resolve;
  });
  g.window.gooseFs = {
    readDirAsync: async () => {
      signalScanStarted();
      await scanGate;
      return [
        {
          name: "target.md",
          path: "/split-tabs-other/target.md",
          isFile: true,
          isDirectory: false,
        },
      ];
    },
    readFileAsync: async () => "# 磁盘旧内容",
  } as GooseFs;
  try {
    const loading = usePages
      .getState()
      .loadLocalFolderPages(otherNotebookId, "/split-tabs-other");
    await scanStarted;
    usePages.setState((state) => ({
      pages: {
        ...state.pages,
        [pageId]: { ...state.pages[pageId], content: savedContent },
      },
      dirtyLocalPageIds: { ...state.dirtyLocalPageIds, [pageId]: false },
    }));
    releaseScan();
    await loading;
  } finally {
    g.window = previousWindow;
  }

  const page = usePages.getState().getPage(pageId);
  expect(page?.content).toEqual(savedContent);
  expect(page?.localFilePath).toBe("/split-tabs-other/target.md");
});

test("分屏焦点快捷切换会立刻同步当前标签", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  useTabs.getState().syncTabPageId(tabId, "b");

  expect(focusNeighbor("left")).toBeTruthy();
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("a");
  expect(usePages.getState().activePageId).toBe("a");
});

test("指针激活分屏只同步状态，不派发会重置点击落点的编辑器聚焦事件", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  const paneId = useEditorSplit.getState().getStateForTab(tabId)!.focusedLeafId;

  const g = globalThis as typeof globalThis & { window?: Window };
  const previousWindow = g.window;
  const dispatched: string[] = [];
  g.window = {
    dispatchEvent: (event: Event) => {
      dispatched.push(event.type);
      return true;
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  } as unknown as Window;
  try {
    expect(focusSplitPane(tabId, paneId, { focusEditor: false })).toBe("b");
    expect(dispatched).not.toContain("goose-note:focus-editor-body");

    expect(focusSplitPane(tabId, paneId)).toBe("b");
    expect(dispatched).toContain("goose-note:focus-editor-body");
  } finally {
    g.window = previousWindow;
  }
});

test("前后分屏格按视觉顺序循环，并同步页面状态", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");

  expect(focusNextSplitPane()).toBe("a");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");
  expect(usePages.getState().activePageId).toBe("a");

  expect(focusPreviousSplitPane()).toBe("b");
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("b");
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("b");
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
  expect(css).toContain("hsl(var(--ring))");
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

test("分屏里删除当前格的页面只关那一格，标签和另一篇笔记还在", () => {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      empty: makePage("empty", {
        localUnsaved: true,
        content: [{ type: "paragraph", content: "" }],
      }),
    },
    activePageId: "a",
  }));
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "empty");
  useTabs.getState().syncTabPageId(tabId, "empty");
  usePages.setState({ activePageId: "empty" });

  useTabs.getState().removeDeletedPage("empty");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(1);
  expect(tabs[0].id).toBe(tabId);
  expect(tabs[0].pageId).toBe("a");
  expect(useEditorSplit.getState().isSplit(tabId)).toBe(false);
  expect(useEditorSplit.getState().focusedPageId(tabId)).toBe("a");
});

test("分屏里删除另一格的页面也只关那一格", () => {
  useTabs.getState().openPermanentTab("a");
  const tabId = useTabs.getState().activeTabId!;
  splitTab(tabId, "b");
  useTabs.getState().syncTabPageId(tabId, "b");
  usePages.setState({ activePageId: "b" });

  useTabs.getState().removeDeletedPage("a");

  const tabs = useTabs.getState().openTabs;
  expect(tabs).toHaveLength(1);
  expect(tabs[0].id).toBe(tabId);
  expect(tabs[0].pageId).toBe("b");
  expect(useEditorSplit.getState().isSplit(tabId)).toBe(false);
});

test("多标签删除某个已打开的页面只关对应标签", () => {
  useTabs.getState().openPermanentTab("a");
  useTabs.getState().openPermanentTab("b");
  useTabs.getState().openPermanentTab("c");
  expect(useTabs.getState().openTabs).toHaveLength(3);

  usePages.setState({ activePageId: "b" });
  useTabs.getState().removeDeletedPage("b");

  const tabs = useTabs.getState().openTabs;
  expect(tabs.map((tab) => tab.pageId)).toEqual(["a", "c"]);
  expect(tabs.every((tab) => tab.pageId !== "b")).toBe(true);
});
