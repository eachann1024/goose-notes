import type { Page } from "playwright/test";
import { expect } from "playwright/test";

export async function installHostMocks(page: Page) {
  await page.addInitScript(() => {
    const DOC_STORE_KEY = "__pw_utools_docs__";
    const ATTACHMENT_STORE_KEY = "__pw_utools_attachments__";

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
      ai: async () => ({ content: "模拟的 AI 结果" }),
    };

    Object.defineProperty(window, "utools", {
      configurable: true,
      writable: true,
      value: utools,
    });
  });
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
