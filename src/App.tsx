import { useEffect } from "react";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";
import { useOnboardingGuide } from "./stores/useOnboardingGuide";
import { OnboardingOverlay } from "./components/onboarding/OnboardingOverlay";

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
  } = useSettings();
  const { createOnboardingPages, onboardingCompleted, hydrated } = usePages();
  const { start: startGuide, completed: guideCompleted } = useOnboardingGuide();

  useEffect(() => {
    if (hydrated && !onboardingCompleted) {
      createOnboardingPages();
    }
  }, [hydrated, onboardingCompleted, createOnboardingPages]);

  // 当基础页面加载完成，且交互引导从未展示过时，自动开启
  useEffect(() => {
    if (hydrated && onboardingCompleted && !guideCompleted) {
      // 稍微延迟一点开启，确保界面渲染稳定
      const timer = setTimeout(() => {
        startGuide();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hydrated, onboardingCompleted, guideCompleted, startGuide]);

  useEffect(() => {
    const openFolder = (folderPath: string) => {
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(
          `本地 - ${folderPath.split("/").pop() || "Unknown"}`,
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

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        increaseEditorFontSize();
      } else if (event.key === "-") {
        event.preventDefault();
        decreaseEditorFontSize();
      } else if (event.key === "0") {
        event.preventDefault();
        setEditorFontSize(EDITOR_FONT_SIZE_DEFAULT);
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
      <OnboardingOverlay />
    </>
  );
}

export default App;
