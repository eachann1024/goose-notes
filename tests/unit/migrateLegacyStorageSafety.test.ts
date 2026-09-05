import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import {
  clearElectronLocalStorageRuntime,
  installElectronLocalStorageRuntime,
} from "./electronLocalStorageRuntime";
import { migrateLegacyStorage } from "../../src/lib/storage/migrateLegacyStorage";

const LEGACY_PAGES_KEY = "goose-note-storage";
const MIGRATION_MARK_KEY = "goose-note:storage-migration:v2";
const DB_KEY = "goose-note:web-db";

const page = (id: string, content: string): Page => ({
  id,
  workspaceId: "legacy-notebook",
  content: [{ type: "paragraph", content }] as never,
  isLocked: false,
  fontSize: "default",
  fontFamily: "default",
  createdAt: 1,
  updatedAt: 2,
});

const legacyEnvelope = (pages: Record<string, Page>) =>
  JSON.stringify({ state: { pages, onboardingCompleted: true } });

const storedDocs = (values: Map<string, string>) =>
  JSON.parse(values.get(DB_KEY) ?? "{}") as Record<
    string,
    { data: unknown }
  >;

test.beforeEach(() => clearElectronLocalStorageRuntime());
test.afterEach(() => clearElectronLocalStorageRuntime());

test("已有新格式页面且无迁移标记时保留新页面并补迁移其它旧页面", async () => {
  const runtime = installElectronLocalStorageRuntime();
  runtime.put("gn:page:same", page("same", "new content"));
  runtime.values.set(
    LEGACY_PAGES_KEY,
    legacyEnvelope({
      same: page("same", "legacy content"),
      other: page("other", "other legacy content"),
    }),
  );

  await migrateLegacyStorage();

  const docs = storedDocs(runtime.values);
  expect((docs["gn:page:same"].data as Page).content).toEqual(
    page("same", "new content").content,
  );
  expect((docs["gn:page:other"].data as Page).content).toEqual(
    page("other", "other legacy content").content,
  );
  expect(runtime.values.get(MIGRATION_MARK_KEY)).toBe("1");
});

test("legacy pages 缺失时不清理现有数据也不写迁移标记", async () => {
  const runtime = installElectronLocalStorageRuntime();
  runtime.put("gn:page:existing", page("existing", "safe"));
  runtime.values.set("goose-note-notebooks", JSON.stringify({ state: {} }));

  await migrateLegacyStorage();

  const docs = storedDocs(runtime.values);
  expect(docs["gn:page:existing"]).toBeTruthy();
  expect(runtime.values.has(MIGRATION_MARK_KEY)).toBe(false);
  expect(runtime.values.has("goose-note-notebooks")).toBe(true);
});

test("legacy pages 损坏或为空时保留原始数据并允许之后重试", async () => {
  for (const raw of ["{broken", legacyEnvelope({})]) {
    const runtime = installElectronLocalStorageRuntime();
    runtime.put("gn:page:existing", page("existing", "safe"));
    runtime.values.set(LEGACY_PAGES_KEY, raw);

    await migrateLegacyStorage();

    const docs = storedDocs(runtime.values);
    expect(docs["gn:page:existing"]).toBeTruthy();
    expect(runtime.values.has(MIGRATION_MARK_KEY)).toBe(false);
    expect(runtime.values.get(LEGACY_PAGES_KEY)).toBe(raw);
    clearElectronLocalStorageRuntime();
  }
});

test("迁移后保留当前 Zustand notebook 和 settings 内容", async () => {
  const runtime = installElectronLocalStorageRuntime();
  const notebooks = JSON.stringify({
    state: { notebooks: { legacy: { id: "legacy", name: "Legacy" } } },
    version: 4,
  });
  const settings = JSON.stringify({ state: { theme: "dark" }, version: 3 });
  runtime.values.set(LEGACY_PAGES_KEY, legacyEnvelope({ one: page("one", "content") }));
  runtime.values.set("goose-note-notebooks", notebooks);
  runtime.values.set("goose-note-settings", settings);

  await migrateLegacyStorage();

  expect(JSON.parse(runtime.values.get("goose-note-notebooks") ?? "{}")).toEqual({
    state: {
      notebooks: {
        legacy: { id: "legacy", name: "Legacy" },
        "legacy-notebook": expect.any(Object),
      },
    },
    version: 4,
  });
  expect(runtime.values.get("goose-note-settings")).toBe(settings);
  expect(runtime.values.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(runtime.values.get(MIGRATION_MARK_KEY)).toBe("1");
});

test("迁移 notebook 时保留 Zustand envelope 与未知 state 字段", async () => {
  const runtime = installElectronLocalStorageRuntime();
  runtime.values.set(LEGACY_PAGES_KEY, legacyEnvelope({ one: page("one", "content") }));
  runtime.values.set(
    "goose-note-notebooks",
    JSON.stringify({
      version: 7,
      envelopeExtension: { retained: true },
      state: {
        notebooks: { legacy: { id: "legacy", name: "Legacy" } },
        activeNotebookId: "legacy",
        lastActivePageByNotebook: { legacy: "one" },
        futureStateField: { retained: true },
      },
    }),
  );

  await migrateLegacyStorage();

  expect(JSON.parse(runtime.values.get("goose-note-notebooks") ?? "{}")).toEqual({
    version: 7,
    envelopeExtension: { retained: true },
    state: {
      notebooks: {
        legacy: { id: "legacy", name: "Legacy" },
        "legacy-notebook": expect.any(Object),
      },
      activeNotebookId: "legacy",
      lastActivePageByNotebook: { legacy: "one" },
      futureStateField: { retained: true },
    },
  });
});

test("migration 标记写入失败时保留 legacy 源且后续可重试", async () => {
  const pagesRaw = legacyEnvelope({ one: page("one", "content") });
  const failedRuntime = installElectronLocalStorageRuntime({
    failLocalStorageSet: (key) => key === MIGRATION_MARK_KEY,
  });
  failedRuntime.values.set(LEGACY_PAGES_KEY, pagesRaw);

  await migrateLegacyStorage();

  expect(failedRuntime.values.get(LEGACY_PAGES_KEY)).toBe(pagesRaw);
  expect(failedRuntime.values.has(MIGRATION_MARK_KEY)).toBe(false);
  clearElectronLocalStorageRuntime();

  const retryRuntime = installElectronLocalStorageRuntime();
  retryRuntime.values.set(LEGACY_PAGES_KEY, pagesRaw);
  await migrateLegacyStorage();
  expect(retryRuntime.values.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(retryRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
});

test("legacy 源删除失败后保留标记，并在后续启动幂等清理", async () => {
  const pagesRaw = legacyEnvelope({ one: page("one", "content") });
  const failedRuntime = installElectronLocalStorageRuntime({
    failLocalStorageRemove: (key) => key === LEGACY_PAGES_KEY,
  });
  failedRuntime.values.set(LEGACY_PAGES_KEY, pagesRaw);

  await migrateLegacyStorage();

  expect(failedRuntime.values.get(LEGACY_PAGES_KEY)).toBe(pagesRaw);
  expect(failedRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
  clearElectronLocalStorageRuntime();

  const retryRuntime = installElectronLocalStorageRuntime();
  retryRuntime.values.set(LEGACY_PAGES_KEY, pagesRaw);
  retryRuntime.values.set(MIGRATION_MARK_KEY, "1");
  await migrateLegacyStorage();
  expect(retryRuntime.values.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(retryRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
});

test("legacy pages DB 文档删除写入失败后保留标记，并在重启后幂等清理", async () => {
  const failedRuntime = installElectronLocalStorageRuntime({
    failWebDbWrite: (value) => !JSON.parse(value)[LEGACY_PAGES_KEY],
  });
  failedRuntime.put(
    LEGACY_PAGES_KEY,
    legacyEnvelope({ one: page("one", "content") }),
  );

  await migrateLegacyStorage();

  expect(failedRuntime.docs.has(LEGACY_PAGES_KEY)).toBe(true);
  expect(failedRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
  const persistedDb = failedRuntime.values.get(DB_KEY);
  clearElectronLocalStorageRuntime();

  const retryRuntime = installElectronLocalStorageRuntime();
  retryRuntime.values.set(DB_KEY, persistedDb ?? "{}");
  retryRuntime.values.set(MIGRATION_MARK_KEY, "1");
  await migrateLegacyStorage();

  expect(retryRuntime.docs.has(LEGACY_PAGES_KEY)).toBe(false);
  expect(retryRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
});

test("notebook、settings 或 pages meta 写入失败时不清理、不标记且可重试", async () => {
  const cases = [
    { key: "goose-note-notebooks", rawSettings: null },
    { key: "goose-note-settings", rawSettings: JSON.stringify({ state: { theme: "dark" } }) },
    { key: "goose-note-pages-meta", rawSettings: null },
  ];

  for (const { key, rawSettings } of cases) {
    const runtime = installElectronLocalStorageRuntime({
      failLocalStorageSet: (storageKey) => storageKey === key,
    });
    const pagesRaw = legacyEnvelope({ one: page("one", "content") });
    runtime.values.set(LEGACY_PAGES_KEY, pagesRaw);
    if (rawSettings) runtime.values.set("goose-note-settings", rawSettings);

    await migrateLegacyStorage();

    expect(runtime.values.get(LEGACY_PAGES_KEY)).toBe(pagesRaw);
    expect(runtime.values.has(MIGRATION_MARK_KEY)).toBe(false);
    clearElectronLocalStorageRuntime();

    const retryRuntime = installElectronLocalStorageRuntime();
    retryRuntime.values.set(LEGACY_PAGES_KEY, pagesRaw);
    if (rawSettings) retryRuntime.values.set("goose-note-settings", rawSettings);
    await migrateLegacyStorage();
    expect(retryRuntime.values.has(LEGACY_PAGES_KEY)).toBe(false);
    expect(retryRuntime.values.get(MIGRATION_MARK_KEY)).toBe("1");
    clearElectronLocalStorageRuntime();
  }
});
