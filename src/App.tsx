import { useEffect } from "react";
import { toast } from "sonner";
import { UToolsAdapter } from "@/lib/utools";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useTabs } from "./stores/useTabs";
import {
  useSettings,
  EDITOR_FONT_SIZE_DEFAULT,
} from "@/stores/useSettings";

const UI_FONT_SIZE_MAP = {
  small: 14,
  normal: 16,
  large: 18,
} as const;

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
  const { hydrated, onboardingCompleted } = usePages();

  useEffect(() => {
    if (utools.windowHeight) {
      UToolsAdapter.setExpendHeight(utools.windowHeight);
    }
  }, [utools.windowHeight]);

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
    const validTabs = openTabs.filter((id) => pages[id] && !pages[id].trashedAt);
    if (validTabs.length !== openTabs.length) {
      useTabs.setState({ openTabs: validTabs });
      if (useTabs.getState().activeTabId && !validTabs.includes(useTabs.getState().activeTabId!)) {
        useTabs.setState({ activeTabId: validTabs[0] ?? null });
      }
    }

    // 如果 activePageId 存在但不在 tabs 中（旧数据迁移），自动加入
    if (activePageId && !useTabs.getState().openTabs.includes(activePageId) && pages[activePageId]) {
      openTab(activePageId);
    }
  }, [hydrated]);

  useEffect(() => {
    // 注册 uTools 进入插件事件监听，用于处理自动打开搜索等逻辑
    if (typeof window !== "undefined" && (window as any).utools) {
      (window as any).utools.onPluginEnter(() => {
        const state = useSettings.getState();

        // 立即应用窗口高度
        if (state.utools.windowHeight) {
          UToolsAdapter.setExpendHeight(state.utools.windowHeight);
        }

        // 确保 CommandPalette 已挂载并能接收事件
        // 使用 requestAnimationFrame 略微延迟以确保 UI 响应
        // requestAnimationFrame(() => {
        //   if (state.utools.autoOpenSearch) {
        //      window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        //   }
        // });
      });
    }
  }, []);

  // 根据隐私设置决定是否自动打开上次笔记
  useEffect(() => {
    if (!hydrated) return;

    const { privacy } = useSettings.getState();
    if (!privacy.autoOpenLastNote) {
      // 关闭自动打开，清空当前活跃页面
      usePages.getState().setActivePage(null);
    }
  }, [hydrated]);

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
    if (typeof window === "undefined") return;

    const handlePluginOut = () => {
      void (async () => {
        window.dispatchEvent(
          new CustomEvent("goose-note:flush-editor", {
            detail: { immediate: true },
          }),
        );
        await usePages.getState().flushPendingLocalSaves();
        const { flushUToolsStorageWrites } = await import("@/lib/storage");
        await flushUToolsStorageWrites();
      })();
    };

    window.addEventListener("goose-note:plugin-out", handlePluginOut);
    return () => {
      window.removeEventListener("goose-note:plugin-out", handlePluginOut);
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
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${editorFontSize}px`,
    );
  }, [editorFontSize]);

  useEffect(() => {
    applyFontVariables(customFonts);
  }, [customFonts]);

  useEffect(() => {
    const handleZoomKeys = (event: KeyboardEvent) => {
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
        (target.isContentEditable || !!target.closest(".ProseMirror"));

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

      if (isEditableInput) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void (async () => {
          window.dispatchEvent(
            new CustomEvent("goose-note:flush-editor", {
              detail: { immediate: true },
            }),
          );
          await usePages.getState().flushPendingLocalSaves();
          const { flushUToolsStorageWrites } = await import("@/lib/storage");
          await flushUToolsStorageWrites();
          toast("内容已保存", { duration: 1500 });
        })();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        increaseEditorFontSize();
      } else if (event.key === "-") {
        event.preventDefault();
        decreaseEditorFontSize();
      } else if (event.key === "0") {
        event.preventDefault();
        setEditorFontSize(EDITOR_FONT_SIZE_DEFAULT);
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

    document.addEventListener("keydown", handleZoomKeys);
    return () => {
      document.removeEventListener("keydown", handleZoomKeys);
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
      <Toaster />
    </>
  );
}

export default App;
