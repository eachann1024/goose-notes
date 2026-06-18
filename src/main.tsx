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
      // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const it = this;
      let i = 0;
      return (function* () {
        for (let r = it.next(); !r.done; r = it.next()) {
          if (fn(r.value, i++)) yield r.value;
        }
      })();
    });
    define("map", function (this: Iterator<unknown>, fn: (v: unknown, i: number) => unknown) {
      // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const it = this;
      let i = 0;
      return (function* () {
        for (let r = it.next(); !r.done; r = it.next()) yield fn(r.value, i++);
      })();
    });
    define("take", function (this: Iterator<unknown>, limit: number) {
      // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
      // eslint-disable-next-line @typescript-eslint/no-this-alias
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
      // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
      // eslint-disable-next-line @typescript-eslint/no-this-alias
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
      // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
      // eslint-disable-next-line @typescript-eslint/no-this-alias
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
import type { ReactNode } from "react";
import { toast } from "sonner";
import "./index.css";
import "./fonts.css";
import App from "./App.tsx";
import { applyFontVariables } from "./lib/fontLoader";
import {
  migrateCodeStyleTo2026,
  runCodeStyleMigration2026,
} from "./lib/code-style-migration";
import { recoverMissingNotebooksFromPages } from "./lib/storage/recoverMissingNotebooks";
import { migrateLegacyStorage } from "./lib/storage/migrateLegacyStorage";
import { UToolsAdapter } from "./lib/utools";
import { DEFAULT_NOTEBOOK, useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";
import { useSettings } from "./stores/useSettings";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

let flushInFlight: Promise<void> | null = null;

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

const hasVisiblePagesInNotebook = (
  notebookId: string | null,
  pages: ReturnType<typeof usePages.getState>["pages"],
) => {
  if (!notebookId) return false;

  return Object.values(pages).some(
    (page) => page.workspaceId === notebookId && !page.trashedAt,
  );
};

// 「打开后 5 秒时间窗写盘守卫」（setupMarkdownOpenWriteGuard / setupLocalContentUpdateGuard /
// setupEditorMutationTracker + gooseFs monkey-patch）已整套移除：
// 打开零写盘现在由链路本身保证——编辑器层用户意图门控（Editor.tsx / EditorComposer.tsx）、
// updatePage silent 分流（stores/pages/index.ts）、写盘前 diff 兜底（write.ts + local-md-snapshot.ts）。
// goose-raw fence 的 decode 职责随之收归 write.ts 的写盘路径。

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

// 渲染目标可被覆盖：主窗口渲染 <App/>，速记小窗（quicknote.tsx）复用同一套
// host fs / 迁移 / hydration / guard 流程，仅把渲染根换成 <QuickNoteApp/>，
// 保证两个窗口进程的数据层初始化完全一致（共享 uTools db）。
export const bootstrap = async (
  renderRoot: () => ReactNode = () => <App />,
) => {
  // DEV-only: install in-memory gooseFs mock before initHostFs（让 scanner /
  // saveLocalPageContent 走与 uTools 相同的 gooseFs 接口）。
  // Tree-shaken out of production builds via the DEV+dynamic-import pattern.
  if (import.meta.env.DEV && location.search.includes("e2eLocalMock")) {
    const { installE2ELocalMock } = await import("@/lib/dev/e2eLocalMock");
    await installE2ELocalMock();
  }

  await initHostFs();
  await migrateLegacyStorage();
  await Promise.all([
    useSettings.persist.rehydrate(),
    useNotebooks.persist.rehydrate(),
  ]);
  // NotebookAiChats 持久化 store（skipHydration=true，需手动水合）
  const { useNotebookAiChats } = await import("@/stores/useNotebookAiChats");
  useNotebookAiChats.persist.rehydrate();
  await usePages.getState().hydrateFromStorage();
  if (import.meta.env.DEV) {
    const { installTestBridge } = await import("@/testBridge");
    installTestBridge();
  }
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
  setupSaveGuards();
  await runCodeStyleMigration2026();

  const settingsStore = useSettings.getState();
  const migratedCodeStyle = migrateCodeStyleTo2026(settingsStore.codeStyle);
  if (migratedCodeStyle !== settingsStore.codeStyle) {
    settingsStore.setCodeStyle(migratedCodeStyle);
  }

  const settings = useSettings.getState();
  applyFontVariables(settings.customFonts);

  createRoot(rootElement).render(renderRoot());

  // 速记收件箱消费：B 插件 redirect 回传的 blocks 落库。
  // 冷启动时 preload 已 push 进 window.__gooseQuickNoteInbox，mount 后在此消费；
  // 热场景（A 已在运行）通过 "goose-note:quicknote-inbox" 事件触发消费。
  const consumeQuickNoteInbox = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const inbox: string[] | undefined = w.__gooseQuickNoteInbox;
    if (!Array.isArray(inbox) || inbox.length === 0) return;
    const items = inbox.splice(0, inbox.length);
    for (const blocksJson of items) {
      try {
        const blocks = JSON.parse(blocksJson);
        const nbId = useNotebooks.getState().activeNotebookId ?? DEFAULT_NOTEBOOK;
        usePages.getState().createPageRecord({ workspaceId: nbId, content: blocks });
      } catch (e) {
        console.error("[quicknote_save] 落库失败", e);
      }
    }
    // 落库后：若是被 redirect 唤起（A 本轮不是用户主动打开的），退回后台。
    if (w.__gooseQuickNoteRedirectWoke) {
      w.__gooseQuickNoteRedirectWoke = false;
      try {
        const ut = w.utools;
        if (ut && typeof ut.outPlugin === "function") {
          ut.outPlugin(false);
        }
      } catch { /* noop */ }
    }
  };
  // 冷启动消费（React 刚 mount，已有积压）
  consumeQuickNoteInbox();
  // 热场景监听
  window.addEventListener("goose-note:quicknote-inbox", consumeQuickNoteInbox);

  // 主窗启动后后台静默预热所有 local-folder 记事本页面，使「所有记事本」全局搜索覆盖全量。
  // 不 await：不阻塞首屏；小窗（quicknote）不预热。idle 时机执行，避开首屏渲染高峰。
  if (rootElement.dataset.entry !== "quicknote") {
    const preloadAll = () => {
      void usePages.getState().loadAllLocalFolderPages();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(preloadAll, { timeout: 4000 });
    } else {
      setTimeout(preloadAll, 1500);
    }
  }
};

// 入口区分：index.html 把 #root 标记为 data-entry="main" → 自动以 <App/> 启动；
// quicknote.html 不带该标记，由 quicknote.tsx 显式调用 bootstrap(<QuickNoteApp/>)。
if (rootElement.dataset.entry !== "quicknote") {
  void bootstrap();
}
