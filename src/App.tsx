import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { UToolsAdapter } from "@/lib/utools";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import {
  useSettings,
  EDITOR_FONT_SIZE_DEFAULT,
  DEFAULT_SEARCH_HOTKEY,
  DEFAULT_WAKE_HOTKEY,
} from "@/stores/useSettings";

const UI_FONT_SIZE_MAP = {
  small: 14,
  normal: 16,
  large: 18,
} as const;

const HOTKEY_FAILURE_NOTICE_STORAGE_KEY =
  "goose-note:hotkey-failure-notice:v1";
const HOTKEY_FAILURE_NOTICE_TTL = 1000 * 60 * 60 * 24;
const LEGACY_DEFAULT_SEARCH_HOTKEY = "CmdOrCtrl+K";

type HotkeyFailureKind = "wake" | "search";

const normalizeHotkeyForCompare = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/commandorcontrol|cmdorcontrol/gi, "cmdorctrl");

const isSameHotkey = (a: string, b: string) =>
  normalizeHotkeyForCompare(a) === normalizeHotkeyForCompare(b);

const shouldNotifyHotkeyFailure = (
  kind: HotkeyFailureKind,
  shortcut: string,
): boolean => {
  if (typeof window === "undefined") return true;

  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const now = Date.now();
  const signature = [kind, normalize(shortcut)].join("|");

  let notices: Record<string, number> = {};
  try {
    const raw = window.localStorage.getItem(HOTKEY_FAILURE_NOTICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (parsed && typeof parsed === "object") {
        notices = parsed;
      }
    }
  } catch {
    notices = {};
  }

  const pruned: Record<string, number> = {};
  for (const [key, timestamp] of Object.entries(notices)) {
    if (typeof timestamp !== "number") continue;
    if (now - timestamp <= HOTKEY_FAILURE_NOTICE_TTL) {
      pruned[key] = timestamp;
    }
  }

  const lastShownAt = pruned[signature];
  const shouldNotify =
    typeof lastShownAt !== "number" ||
    now - lastShownAt > HOTKEY_FAILURE_NOTICE_TTL;

  if (shouldNotify) {
    pruned[signature] = now;
  }

  try {
    window.localStorage.setItem(
      HOTKEY_FAILURE_NOTICE_STORAGE_KEY,
      JSON.stringify(pruned),
    );
  } catch {
    // ignore storage write failures
  }

  return shouldNotify;
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
    desktop,
    setSearchHotkey,
    setWakeHotkey,
  } = useSettings();
  const { hydrated, onboardingCompleted } = usePages();
  const registeredWakeHotkeyRef = useRef<string | null>(null);
  const registeredSearchHotkeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!UToolsAdapter.isTauri) return;

    let disposed = false;

    const cleanupRegisteredHotkeys = async () => {
      const previousWakeHotkey = registeredWakeHotkeyRef.current;
      if (previousWakeHotkey) {
        await UToolsAdapter.unregisterWakeHotkey(previousWakeHotkey);
        registeredWakeHotkeyRef.current = null;
      }

      const previousSearchHotkey = registeredSearchHotkeyRef.current;
      if (previousSearchHotkey) {
        await UToolsAdapter.unregisterSearchHotkey(previousSearchHotkey);
        registeredSearchHotkeyRef.current = null;
      }
    };

    const applyDesktopHotkeys = async () => {
      await cleanupRegisteredHotkeys();

      const nextWakeHotkey =
        (desktop.wakeHotkey ?? "").trim() || DEFAULT_WAKE_HOTKEY;
      if (desktop.wakeHotkeyEnabled) {
        const wakeResult =
          await UToolsAdapter.registerWakeHotkey(nextWakeHotkey);
        if (disposed) {
          if (wakeResult.ok) {
            await UToolsAdapter.unregisterWakeHotkey(nextWakeHotkey);
          }
        } else if (wakeResult.ok) {
          registeredWakeHotkeyRef.current = nextWakeHotkey;
        } else {
          const shouldNotify = shouldNotifyHotkeyFailure("wake", nextWakeHotkey);

          if (nextWakeHotkey !== DEFAULT_WAKE_HOTKEY) {
            setWakeHotkey(DEFAULT_WAKE_HOTKEY);
            if (shouldNotify) {
              toast.error(
                `唤醒快捷键「${nextWakeHotkey}」不可用，已回退到默认：${DEFAULT_WAKE_HOTKEY}`,
                {
                  id: "wake-hotkey-fallback-default",
                  duration: 3200,
                },
              );
            }
          } else if (shouldNotify) {
            toast.error("当前唤醒快捷键不可用，请在设置中更换可用组合键", {
              id: "wake-hotkey-change-required",
              duration: 3200,
            });
          }
        }
      }

      const storedSearchHotkey = (desktop.searchHotkey ?? "").trim();
      const shouldMigrateLegacySearchHotkey = isSameHotkey(
        storedSearchHotkey,
        LEGACY_DEFAULT_SEARCH_HOTKEY,
      );
      const nextSearchHotkey =
        shouldMigrateLegacySearchHotkey || !storedSearchHotkey
          ? DEFAULT_SEARCH_HOTKEY
          : storedSearchHotkey;
      if (desktop.searchHotkeyEnabled) {
        if (
          shouldMigrateLegacySearchHotkey &&
          !isSameHotkey(storedSearchHotkey, DEFAULT_SEARCH_HOTKEY)
        ) {
          setSearchHotkey(DEFAULT_SEARCH_HOTKEY);
        }

        const searchResult =
          await UToolsAdapter.registerSearchHotkey(nextSearchHotkey);
        if (disposed) {
          if (searchResult.ok) {
            await UToolsAdapter.unregisterSearchHotkey(nextSearchHotkey);
          }
        } else if (searchResult.ok) {
          registeredSearchHotkeyRef.current = nextSearchHotkey;
        } else {
          const shouldNotify = shouldNotifyHotkeyFailure(
            "search",
            nextSearchHotkey,
          );

          if (nextSearchHotkey !== DEFAULT_SEARCH_HOTKEY) {
            setSearchHotkey(DEFAULT_SEARCH_HOTKEY);
            if (shouldNotify) {
              toast.error(
                `搜索快捷键「${nextSearchHotkey}」不可用，已回退到默认：${DEFAULT_SEARCH_HOTKEY}`,
                {
                  id: "search-hotkey-fallback-default",
                  duration: 3200,
                },
              );
            }
          } else if (shouldNotify) {
            toast.error("当前搜索快捷键不可用，请在设置中更换可用组合键", {
              id: "search-hotkey-change-required",
              duration: 3200,
            });
          }
        }
      }
    };

    void applyDesktopHotkeys();

    return () => {
      disposed = true;
      const previousWakeHotkey = registeredWakeHotkeyRef.current;
      if (previousWakeHotkey) {
        registeredWakeHotkeyRef.current = null;
        void UToolsAdapter.unregisterWakeHotkey(previousWakeHotkey);
      }
      const previousSearchHotkey = registeredSearchHotkeyRef.current;
      if (previousSearchHotkey) {
        registeredSearchHotkeyRef.current = null;
        void UToolsAdapter.unregisterSearchHotkey(previousSearchHotkey);
      }
    };
  }, [
    desktop.searchHotkey,
    desktop.searchHotkeyEnabled,
    desktop.wakeHotkey,
    desktop.wakeHotkeyEnabled,
    setSearchHotkey,
    setWakeHotkey,
  ]);

  useEffect(() => {
    if (utools.windowHeight) {
      UToolsAdapter.setExpendHeight(utools.windowHeight);
    }
  }, [utools.windowHeight]);

  useEffect(() => {
    if (typeof document === "undefined" || UToolsAdapter.isUTools) return;

    const preventBrowserContextMenu = (event: MouseEvent) => {
      const target = event.target;
      const element =
        target instanceof Element
          ? target
          : target instanceof Node
            ? target.parentElement
            : null;

      if (element?.closest("[data-goose-context-trigger='true']")) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener("contextmenu", preventBrowserContextMenu, {
      capture: true,
    });
    return () => {
      document.removeEventListener("contextmenu", preventBrowserContextMenu, {
        capture: true,
      });
    };
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

      if (
        (event.key === "," ||
          (event.key.toLowerCase() === "k" && event.shiftKey)) &&
        (isEditableInput || isRichTextEditing)
      ) {
        return;
      }

      if (event.key === ",") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        return;
      }

      if (event.key.toLowerCase() === "k" && event.shiftKey) {
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

  const isTauriMacOverlay =
    UToolsAdapter.isTauri &&
    typeof window !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(window.navigator.platform || "");

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle(
      "tauri-mac-overlay-active",
      isTauriMacOverlay,
    );
    return () => {
      document.documentElement.classList.remove("tauri-mac-overlay-active");
    };
  }, [isTauriMacOverlay]);

  const handleMacOverlayDragMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!isTauriMacOverlay) return;
    if (event.button !== 0) return;

    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().startDragging();
      } catch {
        // keep native drag-region behavior as fallback
      }
    })();
  };

  return (
    <>
      {isTauriMacOverlay && (
        <div
          data-tauri-drag-region
          className="tauri-mac-title-drag-region"
          aria-hidden="true"
          onMouseDown={handleMacOverlayDragMouseDown}
        />
      )}
      <WorkspacePage />
      <Toaster />
    </>
  );
}

export default App;
