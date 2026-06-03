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

// Iterator Helpers (ES2025) polyfill — uTools 旧内核 (< Chrome 122) 缺 Iterator.prototype.*。
// @blocknote/xl-ai 直接用了 Map.prototype.values().filter()，缺失时会抛
// `s.values(...).filter is not a function`，导致 AI 调用在错误处理路径二次崩溃。
{
  const IterProto = Object.getPrototypeOf(
    Object.getPrototypeOf([][Symbol.iterator]()),
  ) as Record<string, unknown> | null;
  if (IterProto && typeof (IterProto as any).filter !== "function") {
    const define = (name: string, value: (...args: any[]) => unknown) => {
      Object.defineProperty(IterProto, name, {
        value,
        writable: true,
        configurable: true,
      });
    };

    define("filter", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => boolean) {
      const it = this;
      let i = 0;
      return (function* () {
        for (let r = it.next(); !r.done; r = it.next()) {
          if (fn(r.value, i++)) yield r.value;
        }
      })();
    });
    define("map", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => unknown) {
      const it = this;
      let i = 0;
      return (function* () {
        for (let r = it.next(); !r.done; r = it.next()) yield fn(r.value, i++);
      })();
    });
    define("take", function (this: Iterator<unknown>, limit: number) {
      const it = this;
      return (function* () {
        let n = 0;
        if (n >= limit) return;
        for (let r = it.next(); !r.done; r = it.next()) {
          yield r.value;
          if (++n >= limit) return;
        }
      })();
    });
    define("drop", function (this: Iterator<unknown>, limit: number) {
      const it = this;
      return (function* () {
        let n = 0;
        for (let r = it.next(); !r.done; r = it.next()) {
          if (n++ < limit) continue;
          yield r.value;
        }
      })();
    });
    define("flatMap", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => unknown) {
      const it = this;
      let i = 0;
      return (function* () {
        for (let r = it.next(); !r.done; r = it.next()) {
          const mapped = fn(r.value, i++) as any;
          if (mapped && typeof mapped[Symbol.iterator] === "function") {
            yield* mapped;
          } else {
            yield mapped;
          }
        }
      })();
    });
    define("toArray", function (this: Iterator<unknown>) {
      const out: unknown[] = [];
      for (let r = this.next(); !r.done; r = this.next()) out.push(r.value);
      return out;
    });
    define("forEach", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => void) {
      let i = 0;
      for (let r = this.next(); !r.done; r = this.next()) fn(r.value, i++);
    });
    define("reduce", function (this: Iterator<unknown>, fn: (acc: unknown, v: unknown, i: number) => unknown, init?: unknown) {
      let acc = init;
      let i = 0;
      let r = this.next();
      if (arguments.length < 2) {
        if (r.done) throw new TypeError("Reduce of empty iterator with no initial value");
        acc = r.value;
        r = this.next();
      }
      for (; !r.done; r = this.next()) acc = fn(acc, r.value, i++);
      return acc;
    });
    define("some", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => boolean) {
      let i = 0;
      for (let r = this.next(); !r.done; r = this.next()) if (fn(r.value, i++)) return true;
      return false;
    });
    define("every", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => boolean) {
      let i = 0;
      for (let r = this.next(); !r.done; r = this.next()) if (!fn(r.value, i++)) return false;
      return true;
    });
    define("find", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => boolean) {
      let i = 0;
      for (let r = this.next(); !r.done; r = this.next()) if (fn(r.value, i++)) return r.value;
      return undefined;
    });
  }
}

import { applyRolldownPolyfills } from "@/lib/rolldown-polyfill";
applyRolldownPolyfills();

import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import "./index.css";
import "./fonts.css";
import App from "./App.tsx";
import { applyFontVariables } from "./lib/fontLoader";
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
import { UToolsAdapter } from "./lib/utools";
import { DEFAULT_NOTEBOOK, useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useSettings } from "./stores/useSettings";
import { useStickyNote } from "./stores/useStickyNote";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

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
      // 内容已自动保存；显式保存会再确保落盘并应用「标题→文件名」重命名。
      void pagesState.saveDirtyLocalPage(activePageId).then((ok) => {
        if (ok) toast.success("已保存", { duration: 1200 });
        else toast("内容已是最新", { duration: 1000 });
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
  // uTools 没接上时（浏览器 / bun dev / web 部署），用 File System Access API
  // 作为兜底实现，让 scanner / saveLocalPageContent 走同一套 gooseFs 接口。
  if (typeof window !== "undefined" && !window.gooseFs) {
    try {
      const { installWebGooseFs } = await import("@/lib/web-fs");
      installWebGooseFs();
    } catch (err) {
      console.warn("[bootstrap] web-fs 加载失败", err);
    }
  }
};

const bootstrap = async () => {
  await initHostFs();
  await migrateLegacyStorage();
  await Promise.all([
    useSettings.persist.rehydrate(),
    useNotebooks.persist.rehydrate(),
    useStickyNote.persist.rehydrate(),
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

  createRoot(rootElement).render(<App />);
};

void bootstrap();
