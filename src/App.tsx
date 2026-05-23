import { useEffect } from "react";
import { toast } from "sonner";
import { UToolsAdapter } from "@/lib/utools";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useTabs } from "./stores/useTabs";
import { useStickyNote } from "./stores/useStickyNote";
import { StickyNotePage } from "./pages/sticky-note";
import {
  useSettings,
  EDITOR_FONT_SIZE_DEFAULT,
} from "@/stores/useSettings";

const UI_FONT_SIZE_MAP = {
  small: 14,
  normal: 16,
} as const;

type UToolsPluginEnterDetail = {
  code?: string;
  type?: string;
  payload?: unknown;
  optional?: boolean;
};

const applyUToolsWindowHeight = () => {
  const state = useSettings.getState();
  if (state.utools.windowHeight) {
    UToolsAdapter.setExpendHeight(state.utools.windowHeight);
  }
};

const resolveRestorablePageId = () => {
  const notebooksStore = useNotebooks.getState();
  const pagesStore = usePages.getState();
  const activeNotebookId = notebooksStore.activeNotebookId;
  if (!activeNotebookId) return null;

  const pages = pagesStore.pages;
  const lastPageId = notebooksStore.getLastActivePage(activeNotebookId);
  const lastPage = lastPageId ? pages[lastPageId] : null;
  if (
    lastPage &&
    lastPage.workspaceId === activeNotebookId &&
    !lastPage.trashedAt
  ) {
    return lastPageId;
  }

  const activeNotebook = notebooksStore.notebooks[activeNotebookId];
  if (activeNotebook?.source === "local-folder") {
    return null;
  }

  const firstValidPage = Object.values(pages)
    .filter((page) => page.workspaceId === activeNotebookId && !page.trashedAt)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))[0];

  return firstValidPage?.id ?? null;
};

const restoreLastNoteIfNeeded = () => {
  const pagesStore = usePages.getState();
  if (pagesStore.activePageId) return;

  const targetPageId = resolveRestorablePageId();
  if (!targetPageId) return;

  useTabs.getState().openTab(targetPageId);
};

const clearActivePageForBlankEntry = () => {
  // 保留已打开标签，仅取消当前激活态，使再次唤出回到空白页。
  useTabs.setState({ activeTabId: null });
  const pagesStore = usePages.getState();
  if (!pagesStore.activePageId) return;

  void pagesStore.setActivePage(null);
};

function App() {
  const {
    uiFontSize,
    editorFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    setEditorFontSize,
    customFonts,
    privacy,
    utools,
  } = useSettings();
  const { hydrated, onboardingCompleted, activePageId } = usePages();
  const { active: stickyNoteActive, open: openStickyNote } = useStickyNote();

  // 仅首次挂载时应用一次窗口高度；后续 Slider 释放时会显式调用 setExpendHeight，
  // 避免 store 变化驱动 useEffect 在用户拖动过程中持续触发 uTools API（曾导致卡死）。
  useEffect(() => {
    applyUToolsWindowHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__gooseNoteAutoOpenLastNote = privacy.autoOpenLastNote;
  }, [privacy.autoOpenLastNote]);

  // 首次打开应用时创建新手引导页面
  useEffect(() => {
    if (hydrated && !onboardingCompleted) {
      usePages.getState().createOnboardingPages();
    }
  }, [hydrated, onboardingCompleted]);

  // 同步 tab 状态：旧数据迁移 & 清理已删除页面的 tab
  useEffect(() => {
    if (!hydrated) return;
    const { activePageId, pages } = usePages.getState();
    const { openTabs, openTab } = useTabs.getState();

    // 清理 openTabs 中已不存在的页面
    const validTabs = openTabs.filter(
      (tab) => pages[tab.pageId] && !pages[tab.pageId].trashedAt,
    );
    if (validTabs.length !== openTabs.length) {
      useTabs.setState({ openTabs: validTabs });
      if (
        useTabs.getState().activeTabId &&
        !validTabs.some((tab) => tab.id === useTabs.getState().activeTabId)
      ) {
        useTabs.setState({ activeTabId: validTabs[0]?.id ?? null });
      }
    }

    // 仅在没有标签时，用当前页面初始化第一个标签
    if (
      activePageId &&
      useTabs.getState().openTabs.length === 0 &&
      pages[activePageId]
    ) {
      openTab(activePageId);
    }
  }, [hydrated, activePageId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePluginEnter = (event: Event) => {
      const customEvent = event as CustomEvent<UToolsPluginEnterDetail>;
      const { code } = customEvent.detail || {};

      applyUToolsWindowHeight();

      if (!usePages.getState().hydrated) return;
      if (!useSettings.getState().privacy.autoOpenLastNote) return;
      if (code === "open_folder" || code === "new_page") return;

      restoreLastNoteIfNeeded();
    };

    const handlePluginOut = () => {
      if (!useSettings.getState().privacy.autoOpenLastNote) {
        clearActivePageForBlankEntry();
      }
    };

    const handleOpenStickyNote = () => {
      if (!usePages.getState().hydrated) return;
      openStickyNote();
    };

    window.addEventListener(
      "goose-note:plugin-enter",
      handlePluginEnter as EventListener,
    );
    window.addEventListener(
      "goose-note:plugin-out",
      handlePluginOut as EventListener,
    );
    window.addEventListener(
      "goose-note:open-sticky-note",
      handleOpenStickyNote as EventListener,
    );

    return () => {
      window.removeEventListener(
        "goose-note:plugin-enter",
        handlePluginEnter as EventListener,
      );
      window.removeEventListener(
        "goose-note:plugin-out",
        handlePluginOut as EventListener,
      );
      window.removeEventListener(
        "goose-note:open-sticky-note",
        handleOpenStickyNote as EventListener,
      );
    };
  }, []);

  // 根据隐私设置决定是否自动打开上次笔记
  useEffect(() => {
    if (!hydrated) return;

    const { privacy } = useSettings.getState();
    if (!privacy.autoOpenLastNote) {
      clearActivePageForBlankEntry();
      return;
    }

    restoreLastNoteIfNeeded();
  }, [hydrated, privacy.autoOpenLastNote]);

  useEffect(() => {
    const openFolder = async (folderPath: string) => {
      const folderName = folderPath.split(/[\\/]/).pop() || "Unknown";
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(folderName, folderPath);
      await usePages
        .getState()
        .loadLocalFolderPages(notebookId, folderPath, { showWelcome: true });
    };

    const handleOpenFolder = (event: Event & { detail?: { path: string } }) => {
      const customEvent = event as Event & { detail?: { path: string } };
      const { path: folderPath } = customEvent.detail || {};
      if (typeof folderPath === "string" && folderPath.length > 0) {
        void openFolder(folderPath);
      }
    };

    window.addEventListener(
      "goose-note:open-folder",
      handleOpenFolder as EventListener,
    );

    const pending = (window as { __gooseNotePendingOpenFolder?: string })
      .__gooseNotePendingOpenFolder;
    if (typeof pending === "string" && pending.length > 0) {
      (
        window as Window & { __gooseNotePendingOpenFolder?: string | null }
      ).__gooseNotePendingOpenFolder = null;
      void openFolder(pending);
    }

    return () => {
      window.removeEventListener(
        "goose-note:open-folder",
        handleOpenFolder as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).gooseFs) return;
    const gooseFs = (window as any).gooseFs as GooseFs;
    const notebooksStore = useNotebooks.getState();
    const pagesStore = usePages.getState();
    const notebooks = Object.values(notebooksStore.notebooks).sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const localNotebooks = notebooks.filter(
      (notebook) => notebook.source === "local-folder",
    );

    void (async () => {
      for (const notebook of localNotebooks) {
        const localPath = notebook.localPath;
        const exists =
          typeof localPath === "string" &&
          localPath.length > 0 &&
          (gooseFs.existsAsync
            ? await gooseFs.existsAsync(localPath)
            : gooseFs.exists(localPath));

        if (exists) {
          if (notebook.localPathMissing) {
            notebooksStore.updateNotebook(notebook.id, {
              localPathMissing: false,
            });
          }
          await pagesStore.loadLocalFolderPages(notebook.id, localPath!);
        } else {
          if (!notebook.localPathMissing) {
            notebooksStore.updateNotebook(notebook.id, {
              localPathMissing: true,
            });
          }
          pagesStore.removePagesByWorkspaceId(notebook.id);
        }
      }

      const activeNotebookId = notebooksStore.activeNotebookId;
      const activeNotebook = activeNotebookId
        ? notebooksStore.notebooks[activeNotebookId]
        : null;
      const activeInvalid =
        activeNotebook?.source === "local-folder" &&
        activeNotebook.localPathMissing;

      if (activeInvalid) {
        const nextNotebook =
          notebooks.find((notebook) => !notebook.localPathMissing) ||
          notebooks[0];
        if (nextNotebook && nextNotebook.id !== activeNotebookId) {
          notebooksStore.setActiveNotebook(nextNotebook.id);
          const lastPageId = notebooksStore.getLastActivePage(nextNotebook.id);
          const { pages } = pagesStore;
          const lastPage = lastPageId ? pages[lastPageId] : null;
          if (lastPage && !lastPage.trashedAt) {
            pagesStore.setActivePage(lastPageId);
          } else {
            const firstValidPage = Object.values(pages)
              .filter((p) => p.workspaceId === nextNotebook.id && !p.trashedAt)
              .sort(
                (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
              )[0];
            pagesStore.setActivePage(firstValidPage?.id ?? null);
          }
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const targetSize = UI_FONT_SIZE_MAP[uiFontSize] ?? UI_FONT_SIZE_MAP.small;
    root.style.setProperty("font-size", `${targetSize}px`);
  }, [uiFontSize]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${editorFontSize}px`);
    root.style.setProperty(
      "--editor-scale",
      (editorFontSize / EDITOR_FONT_SIZE_DEFAULT).toFixed(4),
    );
  }, [editorFontSize]);

  useEffect(() => {
    applyFontVariables(customFonts);
  }, [customFonts]);

  useEffect(() => {
    const handleZoomKeys = (event: KeyboardEvent) => {
      const isZoomInKey =
        event.key === "+" ||
        event.key === "=" ||
        event.code === "Equal" ||
        event.code === "NumpadAdd";
      const isZoomOutKey =
        event.key === "-" ||
        event.code === "Minus" ||
        event.code === "NumpadSubtract";
      const isZoomResetKey =
        event.key === "0" ||
        event.code === "Digit0" ||
        event.code === "Numpad0";

      if (event.key === "F3") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("goose-note:editor-find-nav", {
            detail: { direction: event.shiftKey ? -1 : 1 },
          }),
        );
        return;
      }

      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey || event.repeat) return;

      const target = document.activeElement;
      const isEditableInput =
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const isRichTextEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || !!target.closest(".bn-editor"));

      const isOpenSettingsHotkey =
        (event.key === "," || event.key === "，" || event.code === "Comma") &&
        !event.shiftKey;
      const isOpenSearchHotkey =
        event.key.toLowerCase() === "k" && event.shiftKey;

      if (isOpenSearchHotkey && (isEditableInput || isRichTextEditing)) {
        return;
      }

      if (isOpenSettingsHotkey) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        return;
      }

      if (isOpenSearchHotkey) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("goose-note:editor-find-nav", {
            detail: { direction: event.shiftKey ? -1 : 1 },
          }),
        );
        return;
      }

      if (isZoomInKey) {
        event.preventDefault();
        increaseEditorFontSize();
        return;
      }

      if (isZoomOutKey) {
        event.preventDefault();
        decreaseEditorFontSize();
        return;
      }

      if (isZoomResetKey) {
        event.preventDefault();
        setEditorFontSize(EDITOR_FONT_SIZE_DEFAULT);
        return;
      }

      if (isEditableInput) return;

      if (event.key.toLowerCase() === "s" && !event.shiftKey) {
        event.preventDefault();
        void (async () => {
          window.dispatchEvent(
            new CustomEvent("goose-note:flush-editor", {
              detail: { immediate: true },
            }),
          );
          await usePages.getState().flushPendingLocalSaves();
          toast("内容已保存", { duration: 1500 });
        })();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        const { createPage } = usePages.getState();
        const { activeNotebookId } = useNotebooks.getState();
        if (activeNotebookId) {
          const newPageId = createPage(undefined, activeNotebookId);
          useTabs.getState().openTab(newPageId);
          toast("已创建新笔记", { duration: 1500 });
        }
      }
    };

    document.addEventListener("keydown", handleZoomKeys, true);
    return () => {
      document.removeEventListener("keydown", handleZoomKeys, true);
    };
  }, [
    uiFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    setEditorFontSize,
  ]);

  return (
    <>
      <WorkspacePage />
      <StickyNotePage />
      <Toaster />
    </>
  );
}

export default App;
