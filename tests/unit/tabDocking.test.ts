import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { useNotebooks } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useSettings } from "../../src/stores/useSettings";
import { useTabs, type TabItem } from "../../src/stores/useTabs";
import type { Page } from "../../src/types";

const notebookId = "tab-dock-notebook";

function makePage(id: string): Page {
  return {
    id,
    workspaceId: notebookId,
    content: [{ type: "paragraph", content: id }],
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
  };
}

function tab(id: string, pageId: string, extra?: Partial<TabItem>): TabItem {
  return { id, pageId, ...extra };
}

test.beforeEach(() => {
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
  usePages.setState({
    pages: { a: makePage("a"), b: makePage("b") },
    activePageId: "a",
    hydrated: true,
    dirtyLocalPageIds: {},
    flushPendingLocalSaveByPageId: async () => undefined,
  });
  useNotebooks.setState({
    notebooks: {
      [notebookId]: {
        id: notebookId,
        name: "Dock",
        createdAt: 1,
        updatedAt: 1,
      },
    },
    activeNotebookId: notebookId,
    lastActivePageByNotebook: {},
  });
  useSettings.setState({ singleTabMode: false });
  useTabs.setState({
    openTabs: [tab("t-a", "a"), tab("t-b", "b")],
    activeTabId: "t-a",
    tabHistory: ["t-a"],
    tabHistoryIndex: 0,
    isHistoryNavigating: false,
    recentlyClosedPageIds: [],
  });
});

test("adoptTab 插入并激活，releaseTab 不补欢迎页", () => {
  useTabs.setState({
    openTabs: [tab("t-a", "a")],
    activeTabId: "t-a",
  });
  useTabs.getState().adoptTab(tab("t-b", "b"), 1);
  expect(useTabs.getState().openTabs.map((item) => item.id)).toEqual([
    "t-a",
    "t-b",
  ]);
  expect(useTabs.getState().activeTabId).toBe("t-b");

  const moved = useTabs.getState().releaseTab("t-b");
  expect(moved.emptied).toBe(false);
  expect(useTabs.getState().openTabs.map((item) => item.id)).toEqual(["t-a"]);
  expect(useTabs.getState().recentlyClosedPageIds).toEqual([]);

  const last = useTabs.getState().releaseTab("t-a");
  expect(last.emptied).toBe(true);
  expect(useTabs.getState().openTabs).toEqual([]);
  expect(useTabs.getState().activeTabId).toBeNull();
});

test("adoptTab 替换仅剩的欢迎标签", () => {
  useTabs.setState({
    openTabs: [tab("welcome-1", "welcome", { type: "welcome" })],
    activeTabId: "welcome-1",
  });
  useTabs.getState().adoptTab(tab("t-a", "a"), 0);
  expect(useTabs.getState().openTabs).toEqual([
    expect.objectContaining({ id: "t-a", pageId: "a" }),
  ]);
});

test("标签轨接线：拖出走 finishTabDrag，拼回走 accept-tab", () => {
  const tabRail = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/TabRail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const docking = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/useTabDocking.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const ipc = readFileSync(
    new URL("../../electron/main/ipc.ts", import.meta.url),
    "utf8",
  );
  expect(tabRail).toContain("finishTabDrag");
  expect(tabRail).toContain("detachTabFromThisWindow");
  expect(docking).toContain("onAcceptTab");
  expect(docking).toContain("adoptTab");
  expect(ipc).toContain("desktop:finishTabDrag");
  expect(ipc).toContain("desktop:tabDragMove");
});
