import type { Page } from "playwright/test";
import { expect } from "playwright/test";

interface SeedNotebook {
  id: string;
  name: string;
  icon?: string;
  source?: "default" | "local-folder";
  localPath?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface SeedPageDoc {
  id: string;
  workspaceId: string;
  content: unknown;
  localFilePath?: string;
  localReadState?: "ready" | "error";
  localReadError?: string;
  createdAt?: number;
  updatedAt?: number;
  order?: number;
}

export async function installHostMocks(page: Page) {
  await page.addInitScript(() => {
    const DOC_STORE_KEY = "__pw_utools_docs__";
    const ATTACHMENT_STORE_KEY = "__pw_utools_attachments__";
    const AI_MODELS_STORE_KEY = "__pw_utools_ai_models__";
    const AI_CALLS_STORE_KEY = "__pw_utools_ai_calls__";

    const readJson = <T>(key: string, fallback: T): T => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };

    const writeJson = (key: string, value: unknown) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    };

    const nextRev = () =>
      `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

    const dbStorage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key);
      },
    };

    const db = {
      put: (doc: { _id: string; _rev?: string; data: unknown }) => {
        const docs = readJson<
          Record<string, { _id: string; _rev: string; data: unknown }>
        >(DOC_STORE_KEY, {});
        const rev = nextRev();
        docs[doc._id] = {
          _id: doc._id,
          _rev: rev,
          data: doc.data,
        };
        writeJson(DOC_STORE_KEY, docs);
        return { id: doc._id, ok: true, rev };
      },
      get: (id: string) => {
        const docs = readJson<
          Record<string, { _id: string; _rev: string; data: unknown }>
        >(DOC_STORE_KEY, {});
        return docs[id] ?? null;
      },
      remove: (id: string) => {
        const docs = readJson<Record<string, unknown>>(DOC_STORE_KEY, {});
        delete docs[id];
        writeJson(DOC_STORE_KEY, docs);
        return { id, ok: true };
      },
      allDocs: (prefix = "") => {
        const docs = readJson<
          Record<string, { _id: string; _rev: string; data: unknown }>
        >(DOC_STORE_KEY, {});
        return Object.values(docs).filter((doc) => doc._id.startsWith(prefix));
      },
      postAttachment: (id: string, data: Uint8Array, type: string) => {
        const attachments = readJson<
          Record<string, { data: number[]; type: string }>
        >(ATTACHMENT_STORE_KEY, {});
        attachments[id] = {
          data: Array.from(data),
          type,
        };
        writeJson(ATTACHMENT_STORE_KEY, attachments);
        return { id, ok: true };
      },
      getAttachment: (id: string) => {
        const attachments = readJson<
          Record<string, { data: number[]; type: string }>
        >(ATTACHMENT_STORE_KEY, {});
        const entry = attachments[id];
        return entry ? new Uint8Array(entry.data) : null;
      },
      getAttachmentType: (id: string) => {
        const attachments = readJson<
          Record<string, { data: number[]; type: string }>
        >(ATTACHMENT_STORE_KEY, {});
        return attachments[id]?.type ?? null;
      },
    };

    const utools = {
      dbStorage,
      db,
      getUser: () => null,
      copyText: () => {},
      showNotification: () => {},
      shellOpenExternal: () => {},
      shellOpenPath: () => true,
      shellShowItemInFolder: () => true,
      setSublistFn: () => {},
      setExpendHeight: () => true,
      redirect: () => true,
      registerFeature: () => {},
      showOpenDialog: async () => [],
      showSaveDialog: async () => "",
      onPluginEnter: () => {},
      onPluginOut: () => {},
      setSubInput: () => {},
      removeSubInput: () => {},
      setSubInputValue: () => {},
      ubrowser: {
        goto: () => ({
          run: () => {},
        }),
      },
      allAiModels: async () =>
        readJson(AI_MODELS_STORE_KEY, [
          { id: "deepseek-v3", label: "DeepSeek V3" },
          { id: "deepseek-r1", label: "DeepSeek R1" },
        ]),
      ai: async (option: unknown) => {
        const calls = readJson<unknown[]>(AI_CALLS_STORE_KEY, []);
        calls.push(option);
        writeJson(AI_CALLS_STORE_KEY, calls);
        return { content: "模拟的 AI 结果" };
      },
    };

    Object.defineProperty(window, "utools", {
      configurable: true,
      writable: true,
      value: utools,
    });
  });
}

export async function seedUToolsAiState(page: Page, payload?: {
  models?: Array<{ id: string; label: string; description?: string }>;
}) {
  await page.addInitScript((data) => {
    if (Array.isArray(data?.models)) {
      window.localStorage.setItem("__pw_utools_ai_models__", JSON.stringify(data.models));
    }

    window.localStorage.setItem("__pw_utools_ai_calls__", JSON.stringify([]));
  }, payload);
}

export async function readUToolsAiCalls(page: Page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("__pw_utools_ai_calls__") || "[]");
    } catch {
      return [];
    }
  });
}

export async function seedPersistedWorkspaceState(page: Page, payload: {
  notebooks: SeedNotebook[];
  pages: SeedPageDoc[];
}) {
  await page.addInitScript((data) => {
    const docs = JSON.parse(window.localStorage.getItem("__pw_utools_docs__") || "{}");
    const now = Date.now();

    data.pages.forEach((pageDoc: SeedPageDoc, index: number) => {
      docs[`gn:page:${pageDoc.id}`] = {
        _id: `gn:page:${pageDoc.id}`,
        _rev: `seed-${index + 1}`,
        data: {
          id: pageDoc.id,
          workspaceId: pageDoc.workspaceId,
          content: pageDoc.content,
          isFolder: false,
          isLocked: false,
          isFullWidth: false,
          fontSize: "default",
          fontFamily: "default",
          createdAt: pageDoc.createdAt ?? now + index,
          updatedAt: pageDoc.updatedAt ?? now + index,
          order: pageDoc.order ?? now + index,
          localFilePath: pageDoc.localFilePath,
          localReadState: pageDoc.localReadState,
          localReadError: pageDoc.localReadError,
        },
      };
    });

    window.localStorage.setItem("__pw_utools_docs__", JSON.stringify(docs));
    window.localStorage.setItem(
      "goose-note-pages-meta",
      JSON.stringify({ onboardingCompleted: true }),
    );

    const notebookMap = Object.fromEntries(
      data.notebooks.map((notebook: SeedNotebook, index: number) => [
        notebook.id,
        {
          id: notebook.id,
          name: notebook.name,
          icon: notebook.icon ?? (notebook.source === "local-folder" ? "📁" : "📓"),
          source: notebook.source,
          localPath: notebook.localPath,
          createdAt: notebook.createdAt ?? now + index,
          updatedAt: notebook.updatedAt ?? now + index,
        },
      ]),
    );

    window.localStorage.setItem(
      "goose-note-notebooks",
      JSON.stringify({
        state: {
          notebooks: notebookMap,
        },
        version: 0,
      }),
    );
  }, payload);
}

export async function bootApp(page: Page) {
  await installHostMocks(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "鹅的笔记 · 新手指南" }),
  ).toBeVisible();
}

export async function createPageFromSidebar(page: Page) {
  await page.locator('button[aria-label="新建页面"]').click();
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
}

export async function openAiPopover(page: Page, initialAction?: "polish" | "rewrite" | "generate") {
  await page.evaluate((action) => {
    const editor = (window as { __gooseNoteEditor?: any }).__gooseNoteEditor;
    if (!editor) {
      throw new Error("编辑器未挂载");
    }

    document.dispatchEvent(
      new CustomEvent("open-ai-input-popover", {
        detail: {
          editor,
          initialAction: action,
        },
      }),
    );
  }, initialAction);
}

export async function writeNote(page: Page, title: string, body: string) {
  await page.evaluate(
    ({ nextTitle, nextBody }) => {
      const editor = (
        window as {
          __gooseNoteEditor?: {
            commands?: {
              setContent?: (content: unknown, emitUpdate?: boolean) => void;
              focus?: (position: string) => void;
            };
          };
        }
      ).__gooseNoteEditor;

      editor?.commands?.setContent?.(
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: nextTitle }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: nextBody }],
            },
          ],
        },
        true,
      );
      editor?.commands?.focus?.("end");
    },
    { nextTitle: title, nextBody: body },
  );
  await expect(page.locator(".ProseMirror").first()).toContainText(title);
  await expect(page.locator(".ProseMirror").first()).toContainText(body);
}

export async function openSearch(page: Page) {
  await page.locator('button[aria-label="搜索"]').click();
  await expect(getSearchInput(page)).toBeVisible();
}

export function getSearchInput(page: Page) {
  return page.locator('input[placeholder*="搜索"]').first();
}

export async function moveCurrentPageToTrash(page: Page) {
  await page.getByRole("button", { name: "更多操作" }).click();
  await page.getByRole("menuitem", { name: "移至垃圾箱" }).click();
}

export async function openTrash(page: Page) {
  await page.getByRole("button", { name: "垃圾箱" }).click();
}
