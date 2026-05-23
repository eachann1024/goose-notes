// Polyfill for older Chromium (uTools built-in)
if (!(Array.prototype as any).toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", {
    value: function (this: unknown[]) {
      return [...this].reverse();
    },
    writable: true,
    configurable: true,
  });
}

import { applyRolldownPolyfills } from "@/lib/rolldown-polyfill";
applyRolldownPolyfills();

import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import "./index.css";
import "./fonts.css";
import App from "./App.tsx";
import { applyFontVariables, preloadFonts } from "./lib/fontLoader";
import {
  migrateCodeStyleTo2026,
  runCodeStyleMigration2026,
} from "./lib/code-style-migration";
import {
  decodeUnsupportedMarkdownForDisk,
  encodeUnsupportedMarkdownForEditor,
  extractFrontmatter,
} from "./lib/markdown-raw-guard";
import { setFrontmatterForPath } from "./lib/local-frontmatter-store";
import { recoverMissingNotebooksFromPages } from "./lib/storage/recoverMissingNotebooks";
import { migrateLegacyStorage } from "./lib/storage/migrateLegacyStorage";
import {
  getAIAnalyticsContext,
  getNotebookAnalyticsContext,
  initAnalytics,
  syncAnalyticsContext,
  trackEvent,
} from "./lib/analytics";
import { UToolsAdapter } from "./lib/utools";
import { DEFAULT_NOTEBOOK, useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useSettings } from "./stores/useSettings";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const MIXPANEL_TOKEN =
  import.meta.env.VITE_MIXPANEL_TOKEN ||
  (import.meta.env.DEV
    ? import.meta.env.VITE_MIXPANEL_TOKEN_DEV
    : import.meta.env.VITE_MIXPANEL_TOKEN_PROD) ||
  "";

const syncAnalyticsSnapshot = () => {
  syncAnalyticsContext({
    ...getAIAnalyticsContext(useSettings.getState().ai),
    ...getNotebookAnalyticsContext(useNotebooks.getState().notebooks),
  });
};

let flushInFlight: Promise<void> | null = null;
const MARKDOWN_OPEN_WRITE_BLOCK_MS = 5000;
const markdownReadSnapshots = new Map<
  string,
  {
    readAt: number;
    content: string;
  }
>();
const markdownMutationAtByPath = new Map<string, number>();

const flushAllPendingWrites = async () => {
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true },
    }),
  );
  await usePages.getState().flushPendingLocalSaves();
};

const runFlushOnce = () => {
  if (flushInFlight) return flushInFlight;
  flushInFlight = flushAllPendingWrites().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
};

const isMarkdownPath = (filePath: string) => /\.(md|markdown)$/i.test(filePath);
const normalizeFilePath = (filePath: string) => filePath.replace(/\\/g, "/");

const hasVisiblePagesInNotebook = (
  notebookId: string | null,
  pages: ReturnType<typeof usePages.getState>["pages"],
) => {
  if (!notebookId) return false;

  return Object.values(pages).some(
    (page) => page.workspaceId === notebookId && !page.trashedAt,
  );
};

const captureMarkdownRead = (filePath: string, content: string | null | undefined) => {
  if (!isMarkdownPath(filePath)) return;
  if (typeof content !== "string") return;
  markdownReadSnapshots.set(normalizeFilePath(filePath), {
    readAt: Date.now(),
    content,
  });
};

const setupEditorMutationTracker = () => {
  if (typeof document === "undefined") return;
  const hostWindow = window as Window & {
    __gooseNoteEditorMutationTrackerInstalled?: boolean;
  };
  if (hostWindow.__gooseNoteEditorMutationTrackerInstalled) return;
  hostWindow.__gooseNoteEditorMutationTrackerInstalled = true;

  const markMutationIfFromEditor = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const baseElement =
      target instanceof Element ? target : target.parentElement;
    if (!baseElement?.closest(".bn-editor")) return;

    const pagesState = usePages.getState();
    const activePageId = pagesState.activePageId;
    if (!activePageId) return;
    const activePage = pagesState.pages[activePageId];
    const localFilePath =
      typeof activePage?.localFilePath === "string"
        ? activePage.localFilePath
        : null;
    if (!localFilePath || !isMarkdownPath(localFilePath)) return;

    markdownMutationAtByPath.set(
      normalizeFilePath(localFilePath),
      Date.now(),
    );
  };

  document.addEventListener("beforeinput", markMutationIfFromEditor, true);
  document.addEventListener("paste", markMutationIfFromEditor, true);
  document.addEventListener("drop", markMutationIfFromEditor, true);
  document.addEventListener("cut", markMutationIfFromEditor, true);
};

const setupMarkdownOpenWriteGuard = () => {
  if (typeof window === "undefined") return;
  const gooseFs = window.gooseFs;
  if (!gooseFs) return;

  const hostWindow = window as Window & {
    __gooseNoteMarkdownOpenWriteGuardInstalled?: boolean;
  };
  if (hostWindow.__gooseNoteMarkdownOpenWriteGuardInstalled) return;
  hostWindow.__gooseNoteMarkdownOpenWriteGuardInstalled = true;

  const shouldBlockWrite = (filePath: string, content: string) => {
    const normalizedPath = normalizeFilePath(filePath);
    if (!isMarkdownPath(normalizedPath)) return false;
    const snapshot = markdownReadSnapshots.get(normalizedPath);
    if (!snapshot) return false;
    const now = Date.now();
    if (now - snapshot.readAt > MARKDOWN_OPEN_WRITE_BLOCK_MS) return false;
    const lastMutationAt = markdownMutationAtByPath.get(normalizedPath) ?? 0;
    if (lastMutationAt > snapshot.readAt) return false;
    if (content === snapshot.content) return false;
    return true;
  };

  const splitFrontmatterAndEncode = (filePath: string, rawContent: string) => {
    if (!isMarkdownPath(filePath)) return encodeUnsupportedMarkdownForEditor(rawContent);
    const { frontmatter, body } = extractFrontmatter(rawContent);
    setFrontmatterForPath(filePath, frontmatter);
    return encodeUnsupportedMarkdownForEditor(body);
  };

  const readFileAsync = gooseFs.readFileAsync?.bind(gooseFs);
  if (readFileAsync) {
    gooseFs.readFileAsync = async (filePath: string) => {
      const rawContent = await readFileAsync(filePath);
      captureMarkdownRead(filePath, rawContent);
      if (typeof rawContent !== "string") return rawContent;
      return splitFrontmatterAndEncode(filePath, rawContent);
    };
  }

  const readFile = gooseFs.readFile.bind(gooseFs);
  gooseFs.readFile = (filePath: string) => {
    const rawContent = readFile(filePath);
    captureMarkdownRead(filePath, rawContent);
    if (typeof rawContent !== "string") return rawContent;
    return splitFrontmatterAndEncode(filePath, rawContent);
  };

  const writeFileAsync = gooseFs.writeFileAsync?.bind(gooseFs);
  if (writeFileAsync) {
    gooseFs.writeFileAsync = async (
      filePath: string,
      content: string,
      encoding?: string,
    ) => {
      if (encoding === "base64" || encoding === "binary") {
        return writeFileAsync(filePath, content, encoding);
      }
      const diskContent = decodeUnsupportedMarkdownForDisk(content);
      if (shouldBlockWrite(filePath, diskContent)) {
        console.warn("[Markdown Guard] Blocked auto write after open:", filePath);
        return true;
      }
      return writeFileAsync(filePath, diskContent, encoding);
    };
  }

  const writeFile = gooseFs.writeFile.bind(gooseFs);
  gooseFs.writeFile = (filePath: string, content: string, encoding?: string) => {
    if (encoding === "base64" || encoding === "binary") {
      return writeFile(filePath, content, encoding);
    }
    const diskContent = decodeUnsupportedMarkdownForDisk(content);
    if (shouldBlockWrite(filePath, diskContent)) {
      console.warn("[Markdown Guard] Blocked auto write after open:", filePath);
      return true;
    }
    return writeFile(filePath, diskContent, encoding);
  };
};

const setupLocalContentUpdateGuard = () => {
  if (typeof window === "undefined") return;
  const hostWindow = window as Window & {
    __gooseNoteLocalContentUpdateGuardInstalled?: boolean;
  };
  if (hostWindow.__gooseNoteLocalContentUpdateGuardInstalled) return;
  hostWindow.__gooseNoteLocalContentUpdateGuardInstalled = true;

  const store = usePages;
  const originalUpdatePage = store.getState().updatePage;

  store.setState({
    updatePage: (id, updates) => {
      const state = store.getState();
      const page = state.pages[id];
      const localFilePath =
        typeof page?.localFilePath === "string"
          ? normalizeFilePath(page.localFilePath)
          : null;
      const hasOnlyContentUpdate =
        Object.keys(updates).length === 1 && Boolean(updates.content);

      if (
        localFilePath &&
        hasOnlyContentUpdate &&
        state.activePageId === id
      ) {
        const snapshot = markdownReadSnapshots.get(localFilePath);
        const lastMutationAt = markdownMutationAtByPath.get(localFilePath) ?? 0;
        const isInOpenWindow =
          Boolean(snapshot) &&
          Date.now() - (snapshot?.readAt ?? 0) <= MARKDOWN_OPEN_WRITE_BLOCK_MS;
        const hasNoRealEdit = !snapshot || lastMutationAt <= snapshot.readAt;

        // 拦截打开时由程序化 setContent 触发的 updatePage，避免列表排序闪烁。
        if (isInOpenWindow && hasNoRealEdit) {
          return;
        }
      }

      originalUpdatePage(id, updates);
    },
  });
};

const setupSaveGuards = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const hostWindow = window as Window & { __gooseNoteSaveGuardInstalled?: boolean };
  if (hostWindow.__gooseNoteSaveGuardInstalled) return;
  hostWindow.__gooseNoteSaveGuardInstalled = true;

  const handleManualSave = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.isComposing || event.keyCode === 229) return;
    if (!event.metaKey && !event.ctrlKey) return;
    if (event.altKey || event.shiftKey || event.repeat) return;
    if (event.key.toLowerCase() !== "s") return;

    const target = document.activeElement;
    const isEditableInput =
      target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isEditableInput) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // 本地文件夹来源：显式调 saveDirtyLocalPage 写盘；其它来源沿用自动保存 flush。
    const pagesState = usePages.getState();
    const activePageId = pagesState.activePageId;
    const activePage = activePageId ? pagesState.pages[activePageId] : null;
    const isLocalFile =
      Boolean(activePage?.localFilePath) &&
      useNotebooks.getState().notebooks[activePage?.workspaceId ?? ""]
        ?.source === "local-folder";

    if (isLocalFile && activePageId) {
      if (activePage?.localReadState === "error") {
        toast.error("此文件无法解析，已禁用保存", { duration: 1800 });
        return;
      }
      if (!pagesState.isLocalPageDirty(activePageId)) {
        toast("无需保存：没有未保存的更改", { duration: 1200 });
        return;
      }
      void pagesState.saveDirtyLocalPage(activePageId).then((ok) => {
        if (ok) toast.success("已保存", { duration: 1200 });
        else toast.error("保存失败", { duration: 2000 });
      });
      return;
    }

    void runFlushOnce().then(() => {
      toast("内容会自动保存，请放心", { duration: 1500 });
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void runFlushOnce();
    }
  };

  const handleWindowBlur = () => {
    void runFlushOnce();
  };

  const handlePageHide = () => {
    void runFlushOnce();
  };

  const handleBeforeUnload = () => {
    void runFlushOnce();
  };

  const handlePluginOut = () => {
    void runFlushOnce();
  };

  document.addEventListener("keydown", handleManualSave, { capture: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("goose-note:plugin-out", handlePluginOut);
};

const initHostFs = async () => {
  await UToolsAdapter.ensureGooseFs();
};

const bootstrap = async () => {
  await initHostFs();
  await migrateLegacyStorage();
  await Promise.all([
    useSettings.persist.rehydrate(),
    useNotebooks.persist.rehydrate(),
  ]);
  await usePages.getState().hydrateFromStorage();
  const pagesStore = usePages.getState();
  const notebooksStore = useNotebooks.getState();
  const recoveredNotebooks = recoverMissingNotebooksFromPages({
    notebooks: notebooksStore.notebooks,
    pages: pagesStore.pages,
  });

  if (recoveredNotebooks) {
    const shouldFocusRecoveredNotebook = !hasVisiblePagesInNotebook(
      notebooksStore.activeNotebookId,
      pagesStore.pages,
    );
    useNotebooks.setState({
      notebooks: recoveredNotebooks.notebooks,
      ...(shouldFocusRecoveredNotebook
        ? { activeNotebookId: recoveredNotebooks.recoveredNotebookIds[0] ?? null }
        : {}),
    });
    console.warn(
      `[bootstrap] 已从页面数据恢复 ${recoveredNotebooks.recoveredCount} 个缺失记事本索引`,
    );
  }

  const nextNotebooksStore = useNotebooks.getState();
  if (
    !nextNotebooksStore.notebooks[nextNotebooksStore.activeNotebookId || ""]
  ) {
    const firstNotebookId =
      Object.keys(nextNotebooksStore.notebooks)[0] ?? DEFAULT_NOTEBOOK;
    useNotebooks.setState({ activeNotebookId: firstNotebookId });
  }
  setupEditorMutationTracker();
  setupMarkdownOpenWriteGuard();
  setupLocalContentUpdateGuard();
  setupSaveGuards();
  await runCodeStyleMigration2026();

  const settingsStore = useSettings.getState();
  const migratedCodeStyle = migrateCodeStyleTo2026(settingsStore.codeStyle);
  if (migratedCodeStyle !== settingsStore.codeStyle) {
    settingsStore.setCodeStyle(migratedCodeStyle);
  }

  const settings = useSettings.getState();
  applyFontVariables(settings.customFonts);
  preloadFonts();

  const analyticsInitResult = initAnalytics({
    token: MIXPANEL_TOKEN,
    appVersion: import.meta.env.VITE_APP_VERSION || "0.0.0",
    appEnv: import.meta.env.DEV ? "dev" : "prod",
    hostEnv: "utools",
    platform: navigator.platform || "unknown",
    isDev: import.meta.env.DEV,
    enableReplay: true,
  });

  syncAnalyticsSnapshot();

  if (analyticsInitResult) {
    trackEvent("app_opened", {
      feature: "app",
      action: "open",
      result: "success",
      source: "bootstrap",
    });
  }
  useSettings.subscribe((state) => {
    syncAnalyticsContext(getAIAnalyticsContext(state.ai));
  });
  useNotebooks.subscribe((state) => {
    syncAnalyticsContext(getNotebookAnalyticsContext(state.notebooks));
  });

  createRoot(rootElement).render(<App />);
};

void bootstrap();
