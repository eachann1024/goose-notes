import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import { clearElectronLocalStorageRuntime, installElectronLocalStorageRuntime } from "./electronLocalStorageRuntime";
import { migrateLegacyStorage } from "../../src/lib/storage/migrateLegacyStorage";

const LEGACY_PAGES_KEY = "goose-note-storage";
const CLEANUP_KEY = "goose-note:storage-migration:v3-cleanup";
const page = (id: string, content: string): Page => ({
  id, workspaceId: "legacy", content: [{ type: "paragraph", content }] as never,
  isLocked: false, fontSize: "default", fontFamily: "default", createdAt: 1, updatedAt: 2,
});
const envelope = (pages: Record<string, Page>) => JSON.stringify({ state: { pages } });
const data = (runtime: ReturnType<typeof installElectronLocalStorageRuntime>, id: string) =>
  runtime.docs.get(`gn:page:${id}`)?.data as Page | undefined;

test.beforeEach(() => clearElectronLocalStorageRuntime());
test.afterEach(() => clearElectronLocalStorageRuntime());

test("双源不同页面会分别读取、持久化并仅在完成后清理", async () => {
  const runtime = installElectronLocalStorageRuntime();
  runtime.put(LEGACY_PAGES_KEY, envelope({ db: page("db", "from db") }));
  runtime.values.set(LEGACY_PAGES_KEY, envelope({ local: page("local", "from localStorage") }));

  await migrateLegacyStorage();

  expect(data(runtime, "db")?.content).toEqual(page("db", "from db").content);
  expect(data(runtime, "local")?.content).toEqual(page("local", "from localStorage").content);
  expect(runtime.docs.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(runtime.values.has(LEGACY_PAGES_KEY)).toBe(false);
});

test("双 legacy 同 ID 冲突保留确定性的 DB 页面且不删除任一原始 envelope", async () => {
  const runtime = installElectronLocalStorageRuntime();
  const dbRaw = envelope({ same: page("same", "db") });
  const localRaw = envelope({ same: page("same", "localStorage") });
  runtime.put(LEGACY_PAGES_KEY, dbRaw);
  runtime.values.set(LEGACY_PAGES_KEY, localRaw);

  await migrateLegacyStorage();

  expect(data(runtime, "same")?.content).toEqual(page("same", "db").content);
  expect(runtime.docs.get(LEGACY_PAGES_KEY)?.data).toBe(dbRaw);
  expect(runtime.values.get(LEGACY_PAGES_KEY)).toBe(localRaw);
});

test("一个来源损坏时迁移可读来源且不删除损坏来源", async () => {
  const runtime = installElectronLocalStorageRuntime();
  runtime.put(LEGACY_PAGES_KEY, "{broken");
  runtime.values.set(LEGACY_PAGES_KEY, envelope({ local: page("local", "safe") }));

  await migrateLegacyStorage();

  expect(data(runtime, "local")?.content).toEqual(page("local", "safe").content);
  expect(runtime.docs.get(LEGACY_PAGES_KEY)?.data).toBe("{broken");
  expect(runtime.values.has(LEGACY_PAGES_KEY)).toBe(false);
});

test("某来源清理失败会在重启时只重试该来源", async () => {
  const failed = installElectronLocalStorageRuntime({
    failLocalStorageRemove: (key) => key === LEGACY_PAGES_KEY,
  });
  failed.put(LEGACY_PAGES_KEY, envelope({ db: page("db", "db") }));
  failed.values.set(LEGACY_PAGES_KEY, envelope({ local: page("local", "local") }));
  await migrateLegacyStorage();
  const persistedDb = failed.values.get("goose-note:web-db")!;
  const mark = failed.values.get(CLEANUP_KEY)!;
  expect(failed.docs.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(failed.values.has(LEGACY_PAGES_KEY)).toBe(true);
  clearElectronLocalStorageRuntime();

  const retry = installElectronLocalStorageRuntime();
  retry.values.set("goose-note:web-db", persistedDb);
  retry.values.set(LEGACY_PAGES_KEY, envelope({ local: page("local", "local") }));
  retry.values.set("goose-note:storage-migration:v2", "1");
  retry.values.set(CLEANUP_KEY, mark);
  await migrateLegacyStorage();

  expect(retry.values.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(JSON.parse(retry.values.get(CLEANUP_KEY) ?? "{}").cleanupPending).toEqual({});
});
