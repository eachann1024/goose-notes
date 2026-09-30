import { expect, test } from "playwright/test";

async function waitForHydration(page: import("playwright/test").Page) {
  await page.waitForFunction(() => {
    const bridge = (window as Window & { __GOOSE_TEST__?: { getPagesState: () => { hydrated: boolean } } })
      .__GOOSE_TEST__;
    return Boolean(bridge?.getPagesState().hydrated);
  });
}

async function seedTwoPages(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    const bridge = (window as Window & {
      __GOOSE_TEST__?: {
        resetTabs: () => void;
        createPage: (parentId?: string, workspaceId?: string) => string;
        getNotebooksState: () => { activeNotebookId: string | null };
        setCloseTabShortcut: (shortcut: string) => void;
      };
    }).__GOOSE_TEST__;
    if (!bridge) throw new Error("Test bridge unavailable");
    bridge.resetTabs();
    bridge.setCloseTabShortcut("Alt+W");
  });

  await page.waitForFunction(() => Boolean(window.__gooseTest));
  return page.evaluate(async () => {
    const harness = window.__gooseTest;
    if (!harness) throw new Error("Local test harness unavailable");
    const { notebookId } = await harness.setupMockNotebook();
    const a = await harness.stores.usePages.getState().createLocalPage(undefined, notebookId);
    const b = await harness.stores.usePages.getState().createLocalPage(undefined, notebookId);
    if (!a || !b) throw new Error("Could not create local test pages");
    return { a, b };
  });
}

test.describe("stable tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __GOOSE_E2E__?: boolean }).__GOOSE_E2E__ = true;
    });
    await page.goto("/?e2eLocalMock");
    await waitForHydration(page);
  });

  test("pinned tab stays intact when preview-opening another page", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);

    await page.evaluate(
      ({ pageA, pageB }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string, pin?: boolean) => void;
            openPreviewTab: (pageId: string) => void;
            openWelcomeTab: () => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPermanentTab(pageA, true);
        bridge.openWelcomeTab();
        bridge.openPreviewTab(pageB);
      },
      { pageA: a, pageB: b },
    );

    const tabs = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{
              id: string;
              pageId: string;
              pinned?: boolean;
              preview?: boolean;
            }>;
            activeTabId: string | null;
          };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return bridge.getTabsState();
    });

    expect(tabs.openTabs).toHaveLength(2);
    const pinned = tabs.openTabs.find((tab) => tab.pageId === a);
    const preview = tabs.openTabs.find((tab) => tab.pageId === b);
    expect(pinned?.pinned).toBe(true);
    expect(preview?.preview).toBeFalsy();
    expect(preview?.id).toBe(tabs.activeTabId);
    expect(pinned?.pageId).toBe(a);
  });

  test("subsequent sidebar opens preserve all existing tabs", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);
    const c = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          createPage: (parentId?: string, workspaceId?: string) => string;
          getNotebooksState: () => { activeNotebookId: string | null };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      const notebookId =
        bridge.getNotebooksState().activeNotebookId ?? "default-notebook";
      return bridge.createPage(undefined, notebookId);
    });

    await page.evaluate(
      ({ pageA, pageB, pageC }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string) => void;
            openPreviewTab: (pageId: string) => void;
            openWelcomeTab: () => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPermanentTab(pageA);
        bridge.openWelcomeTab();
        bridge.openPreviewTab(pageB);
        bridge.openPreviewTab(pageC);
      },
      { pageA: a, pageB: b, pageC: c },
    );

    const state = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{ preview?: boolean; pageId: string }>;
          };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return bridge.getTabsState();
    });

    expect(state.openTabs.map((tab) => tab.pageId)).toEqual([a, b, c]);
    expect(state.openTabs.every((tab) => !tab.preview)).toBe(true);
  });

  test("sidebar single click preserves the only existing tab", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);

    await page.evaluate(
      ({ pageA }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string) => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPermanentTab(pageA);
      },
      { pageA: a },
    );

    const rowB = page.locator(`[data-rct-item-id="${b}"]`).first();
    await expect(rowB).toBeVisible({ timeout: 15_000 });
    await rowB.click();

    const state = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{ id: string; pageId: string; preview?: boolean }>;
          };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return bridge.getTabsState();
    });

    expect(state.openTabs.map((tab) => tab.pageId)).toEqual([a, b]);
    expect(state.openTabs.every((tab) => !tab.preview)).toBe(true);
  });

  test("sidebar click after plus reuses the empty untitled tab", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);
    const emptyId = await page.evaluate(() => {
      const harness = window.__gooseTest;
      if (!harness) throw new Error("Local test harness unavailable");
      const notebookId = harness.stores.useNotebooks.getState().activeNotebookId;
      if (!notebookId) throw new Error("No active notebook");
      return harness.stores.usePages.getState().createUnsavedLocalPage(notebookId);
    });

    const emptyTabId = await page.evaluate(
      ({ pageA, emptyPageId }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string) => void;
            getTabsState: () => { activeTabId: string | null };
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPermanentTab(pageA);
        bridge.openPermanentTab(emptyPageId);
        return bridge.getTabsState().activeTabId;
      },
      { pageA: a, emptyPageId: emptyId },
    );
    expect(emptyTabId).toBeTruthy();

    const rowB = page.locator(`[data-rct-item-id="${b}"]`).first();
    await expect(rowB).toBeVisible({ timeout: 15_000 });
    await rowB.click();

    const state = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{ id: string; pageId: string; preview?: boolean }>;
            activeTabId: string | null;
          };
          getPagesState: () => { pages: Record<string, unknown> };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return {
        tabs: bridge.getTabsState(),
        pages: bridge.getPagesState().pages,
      };
    });

    expect(state.tabs.openTabs).toHaveLength(2);
    expect(state.tabs.openTabs.map((tab) => tab.pageId)).toEqual([a, b]);
    const filled = state.tabs.openTabs.find((tab) => tab.id === emptyTabId);
    expect(filled?.pageId).toBe(b);
    expect(filled?.preview).toBeFalsy();
    expect(state.tabs.activeTabId).toBe(emptyTabId);
    expect(state.pages[emptyId]).toBeUndefined();
  });

  test("sidebar single click opens preview without replacing pinned tab", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);

    await page.evaluate(
      ({ pageA }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string, pin?: boolean) => void;
            openWelcomeTab: () => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPermanentTab(pageA, true);
        bridge.openWelcomeTab();
      },
      { pageA: a },
    );

    const rowB = page.locator(`[data-rct-item-id="${b}"]`).first();
    await expect(rowB).toBeVisible({ timeout: 15_000 });
    await rowB.click();

    const state = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{
              id: string;
              pageId: string;
              pinned?: boolean;
              preview?: boolean;
            }>;
            activeTabId: string | null;
          };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return bridge.getTabsState();
    });

    const pinned = state.openTabs.find((tab) => tab.pageId === a);
    const preview = state.openTabs.find((tab) => tab.pageId === b);
    expect(pinned?.pinned).toBe(true);
    expect(pinned?.pageId).toBe(a);
    expect(preview?.preview).toBeFalsy();
    expect(state.activeTabId).toBe(preview?.id);
  });

  test("sidebar-opened tab is permanent in tab bar", async ({ page }) => {
    const { a } = await seedTwoPages(page);

    await page.evaluate(
      ({ pageA }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPreviewTab: (pageId: string) => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.openPreviewTab(pageA);
      },
      { pageA: a },
    );

    const previewTab = page.locator(
      `[data-tab-page-id="${a}"][data-tab-preview="false"]`,
    );
    await expect(previewTab).toBeVisible();
  });

  test("notebook switch activates its tab while preserving all open notebook tabs", async ({
    page,
  }) => {
    const ids = await page.evaluate(async () => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          resetTabs: () => void;
          createNotebook: (name?: string, icon?: string) => string;
          createPage: (parentId?: string, workspaceId?: string) => string;
          openPermanentTab: (pageId: string) => void;
          activateNotebook: (notebookId: string) => Promise<string | null>;
          getNotebooksState: () => { activeNotebookId: string | null };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");

      bridge.resetTabs();
      const harness = window.__gooseTest;
      if (!harness) throw new Error("Local test harness unavailable");
      const { notebookId: noteNotebookId } = await harness.setupMockNotebook();
      const notePage = await harness.stores.usePages.getState().createLocalPage(undefined, noteNotebookId);
      const devNotebookId = harness.stores.useNotebooks.getState().createLocalFolderNotebook("Dev", "/mock-notes/sub");
      await harness.stores.usePages.getState().loadLocalFolderPages(devNotebookId, "/mock-notes/sub");
      const devPage = await harness.stores.usePages.getState().createLocalPage(undefined, devNotebookId);
      if (!notePage || !devPage) throw new Error("Could not create local test pages");

      bridge.openPermanentTab(notePage);
      bridge.openPermanentTab(devPage);

      await bridge.activateNotebook(noteNotebookId);
      return { noteNotebookId, notePage, devNotebookId, devPage };
    });

    const afterNoteSwitch = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{ id: string; pageId: string }>;
            activeTabId: string | null;
          };
          getPagesState: () => { activePageId: string | null };
          getNotebooksState: () => { activeNotebookId: string | null };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      const tabs = bridge.getTabsState();
      const activeTab = tabs.openTabs.find(
        (tab) => tab.id === tabs.activeTabId,
      );
      return {
        activeNotebookId: bridge.getNotebooksState().activeNotebookId,
        activePageId: bridge.getPagesState().activePageId,
        activeTabPageId: activeTab?.pageId ?? null,
      };
    });

    expect(afterNoteSwitch.activeNotebookId).toBe(ids.noteNotebookId);
    expect(afterNoteSwitch.activePageId).toBe(ids.notePage);
    expect(afterNoteSwitch.activeTabPageId).toBe(ids.notePage);

    await page.evaluate(async (devNotebookId) => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          activateNotebook: (notebookId: string) => Promise<string | null>;
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      await bridge.activateNotebook(devNotebookId);
    }, ids.devNotebookId);

    const devTab = page.locator(`[data-tab-page-id="${ids.devPage}"]`);
    await expect(devTab).toBeVisible();
    await expect(devTab).toHaveAttribute("data-tab-active", "true");
    await expect(page.locator(`[data-tab-page-id="${ids.notePage}"]`)).toBeVisible();
  });

  test("configured close-tab shortcut works while editor content is focused", async ({
    page,
  }) => {
    const { a, b } = await seedTwoPages(page);

    await page.evaluate(
      ({ pageA, pageB }) => {
        const bridge = (window as Window & {
          __GOOSE_TEST__?: {
            openPermanentTab: (pageId: string) => void;
            setCloseTabShortcut: (shortcut: string) => void;
          };
        }).__GOOSE_TEST__;
        if (!bridge) throw new Error("Test bridge unavailable");
        bridge.setCloseTabShortcut("Ctrl+W");
        bridge.openPermanentTab(pageA);
        bridge.openPermanentTab(pageB);
      },
      { pageA: a, pageB: b },
    );

    await page.evaluate(() => {
      const editorTarget = document.createElement("div");
      editorTarget.className = "bn-editor";
      editorTarget.contentEditable = "true";
      editorTarget.tabIndex = 0;
      document.body.appendChild(editorTarget);
      editorTarget.focus();
      editorTarget.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "w",
          code: "KeyW",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    const state = await page.evaluate(() => {
      const bridge = (window as Window & {
        __GOOSE_TEST__?: {
          getTabsState: () => {
            openTabs: Array<{ pageId: string }>;
            activeTabId: string | null;
          };
        };
      }).__GOOSE_TEST__;
      if (!bridge) throw new Error("Test bridge unavailable");
      return bridge.getTabsState();
    });

    expect(state.openTabs).toHaveLength(1);
    expect(state.openTabs[0].pageId).toBe(a);
  });

  test("global search shortcut works repeatedly while editor content is focused", async ({
    page,
  }) => {
    const openCount = await page.evaluate(() => {
      let count = 0;
      window.addEventListener("goose-note:open-search", () => {
        count += 1;
      });

      const editorTarget = document.createElement("div");
      editorTarget.className = "bn-editor";
      editorTarget.contentEditable = "true";
      editorTarget.tabIndex = 0;
      document.body.appendChild(editorTarget);
      editorTarget.focus();

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const pressSearchShortcut = () => {
        editorTarget.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            code: "KeyK",
            ctrlKey: !isMac,
            metaKey: isMac,
            shiftKey: false,
            bubbles: true,
            cancelable: true,
          }),
        );
      };

      pressSearchShortcut();
      pressSearchShortcut();
      return count;
    });

    expect(openCount).toBe(2);
  });
});
