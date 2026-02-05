import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { UToolsAdapter } from "@/lib/utools";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";

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
    utools,
  } = useSettings();
  const { hydrated, onboardingCompleted } = usePages();
  const onboardingCreatedRef = useRef(false);
  const initialLocalWelcomeRef = useRef(false);

  useEffect(() => {
    if (utools.windowHeight) {
      UToolsAdapter.setExpendHeight(utools.windowHeight);
    }
  }, [utools.windowHeight]);

  // 首次打开应用时创建新手引导页面
  useEffect(() => {
    if (hydrated && !onboardingCompleted && !onboardingCreatedRef.current) {
      onboardingCreatedRef.current = true;
      usePages.getState().createOnboardingPages();
    }
  }, [hydrated, onboardingCompleted]);

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
    if (!hydrated) return;
    if (initialLocalWelcomeRef.current) return;
    initialLocalWelcomeRef.current = true;
    if (typeof window === "undefined" || !(window as any).utools) return;

    const notebooksState = useNotebooks.getState();
    const activeNotebookId = notebooksState.activeNotebookId;
    const activeNotebook = activeNotebookId
      ? notebooksState.notebooks[activeNotebookId]
      : null;

    if (activeNotebook?.source === "local-folder") {
      (window as any).__gooseNoteForceWelcomeOnce = true;
      usePages.getState().setActivePage(null);
    }
  }, [hydrated]);

  useEffect(() => {
    const openFolder = (folderPath: string) => {
      const folderName = folderPath.split(/[\\/]/).pop() || "Unknown";
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(
          folderName,
          folderPath,
        );
      usePages.getState().loadLocalFolderPages(notebookId, folderPath);
    };

    const handleOpenFolder = (event: Event & { detail?: { path: string } }) => {
      const customEvent = event as Event & { detail?: { path: string } };
      const { path: folderPath } = customEvent.detail || {};
      if (typeof folderPath === "string" && folderPath.length > 0) {
        openFolder(folderPath);
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
      openFolder(pending);
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
    const notebooksStore = useNotebooks.getState();
    const pagesStore = usePages.getState();
    const notebooks = Object.values(notebooksStore.notebooks).sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const localNotebooks = notebooks.filter(
      (notebook) => notebook.source === "local-folder",
    );

    localNotebooks.forEach((notebook) => {
      const localPath = notebook.localPath;
      const exists =
        typeof localPath === "string" &&
        localPath.length > 0 &&
        (window as any).gooseFs.exists(localPath);

      if (exists) {
        if (notebook.localPathMissing) {
          notebooksStore.updateNotebook(notebook.id, {
            localPathMissing: false,
          });
        }
        pagesStore.loadLocalFolderPages(notebook.id, localPath!);
      } else {
        if (!notebook.localPathMissing) {
          notebooksStore.updateNotebook(notebook.id, {
            localPathMissing: true,
          });
        }
        pagesStore.removePagesByWorkspaceId(notebook.id);
      }
    });

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
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const targetSize = UI_FONT_SIZE_MAP[uiFontSize] ?? UI_FONT_SIZE_MAP.normal;
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
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey || event.repeat) return;

      const target = document.activeElement;
      const isEditableInput =
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isEditableInput) return;

      if (event.key === "s") {
        event.preventDefault();
        toast("内容已自动保存", { duration: 1500 });
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
          createPage(undefined, activeNotebookId);
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
