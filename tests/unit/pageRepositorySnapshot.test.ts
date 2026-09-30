import { expect, test } from "playwright/test";
import {
  clearPersistedPages,
  loadPagesFromStorage,
  saveInternalPage,
  saveLocalPageMeta,
  savePagesMeta,
  type PersistedLocalPageMetaDoc,
  type PersistedPageDoc,
} from "../../src/lib/storage/pageRepository";
import { HostAdapter } from "../../src/lib/host/adapter";
import type { Page } from "../../src/types";
import {
  clearElectronLocalStorageRuntime,
  installElectronLocalStorageRuntime,
} from "./electronLocalStorageRuntime";

test.beforeEach(() => {
  clearElectronLocalStorageRuntime();
  installElectronLocalStorageRuntime();
});

test.afterEach(() => {
  clearElectronLocalStorageRuntime();
});

test("空库场景只调用一次 HostAdapter.db.allDocs('gn:')", () => {
  const allDocsCalls: string[] = [];
  const originalAllDocs = HostAdapter.db.allDocs.bind(HostAdapter.db);
  HostAdapter.db.allDocs = (<T = unknown>(prefix?: string) => {
    allDocsCalls.push(prefix ?? "");
    return originalAllDocs<T>(prefix);
  }) as typeof HostAdapter.db.allDocs;

  try {
    const result = loadPagesFromStorage();
    expect(allDocsCalls).toEqual(["gn:"]);
    expect(result.pages).toEqual({});
    expect(result.localPageMetas).toEqual({});
    expect(result.onboardingCompleted).toBe(false);
  } finally {
    HostAdapter.db.allDocs = originalAllDocs;
  }
});

test("混合 page / localmeta / WAL / 非 gn 数据过滤准确且 legacy isFullWidth 被剔除", () => {
  const allDocsCalls: string[] = [];
  const originalAllDocs = HostAdapter.db.allDocs.bind(HostAdapter.db);
  HostAdapter.db.allDocs = (<T = unknown>(prefix?: string) => {
    allDocsCalls.push(prefix ?? "");
    return originalAllDocs<T>(prefix);
  }) as typeof HostAdapter.db.allDocs;

  try {
    // 写入内部页（含 legacy isFullWidth）
    HostAdapter.db.put("gn:page:p1", {
      id: "p1",
      workspaceId: "ws-1",
      title: "Page 1",
      content: [],
      createdAt: 1000,
      updatedAt: 2000,
      isFullWidth: true,
    } as unknown as PersistedPageDoc);

    // 写入 localmeta（含 legacy isFullWidth）
    HostAdapter.db.put("gn:local-meta:p1", {
      pageId: "p1",
      workspaceId: "ws-1",
      updatedAt: 2000,
      isFavorite: true,
      isFullWidth: false,
    } as unknown as PersistedLocalPageMetaDoc);

    // 写入 WAL / 恢复日志数据（gn:recovery-wal: 开头）
    HostAdapter.db.put("gn:recovery-wal:p1", {
      entry: { id: "p1", source: "page", content: [] },
    });

    // 写入非 gn 开头或其它前缀数据
    HostAdapter.db.put("other:key", { foo: "bar" });
    savePagesMeta({ onboardingCompleted: true });

    const result = loadPagesFromStorage();

    // 证明只进行了一次前缀查询 'gn:'
    expect(allDocsCalls).toEqual(["gn:"]);

    // WAL 和 非 gn 数据不进入 pages 和 localPageMetas
    expect(Object.keys(result.pages)).toEqual(["p1"]);
    expect(Object.keys(result.localPageMetas)).toEqual(["p1"]);

    // 验证 legacy 字段已被剔除
    expect((result.pages.p1 as any).isFullWidth).toBeUndefined();
    expect((result.localPageMetas.p1 as any).isFullWidth).toBeUndefined();
    expect(result.pages.p1.title).toBe("Page 1");
    expect(result.localPageMetas.p1.isFavorite).toBe(true);
    expect(result.onboardingCompleted).toBe(true);
  } finally {
    HostAdapter.db.allDocs = originalAllDocs;
  }
});

test("过期垃圾页自动清理时仅删除过期页，不影响未过期页与 WAL 数据", () => {
  const now = Date.now();
  const expiredTime = now - (31 * 24 * 60 * 60 * 1000); // 31天前移入回收站
  const recentTime = now - (10 * 24 * 60 * 60 * 1000);  // 10天前移入回收站

  // 过期页
  HostAdapter.db.put("gn:page:expired-page", {
    id: "expired-page",
    workspaceId: "ws-1",
    title: "Expired",
    content: [],
    createdAt: expiredTime - 1000,
    updatedAt: expiredTime,
    trashedAt: expiredTime,
  } as unknown as PersistedPageDoc);

  // 未过期页
  HostAdapter.db.put("gn:page:recent-trash", {
    id: "recent-trash",
    workspaceId: "ws-1",
    title: "Recent Trash",
    content: [],
    createdAt: recentTime - 1000,
    updatedAt: recentTime,
    trashedAt: recentTime,
  } as unknown as PersistedPageDoc);

  // WAL 数据
  HostAdapter.db.put("gn:recovery-wal:expired-page", {
    entry: { id: "expired-page", source: "page", content: [] },
  });

  const removedIds: string[] = [];
  const originalRemove = HostAdapter.db.remove.bind(HostAdapter.db);
  HostAdapter.db.remove = ((id: string) => {
    removedIds.push(id);
    return originalRemove(id);
  }) as typeof HostAdapter.db.remove;

  try {
    const loaded = loadPagesFromStorage();

    // 返回的 pages 不包含过期页，包含未过期页
    expect(loaded.pages["expired-page"]).toBeUndefined();
    expect(loaded.pages["recent-trash"]).toBeDefined();

    // 数据库中过期页被删除，WAL 未被删除
    expect(removedIds).toEqual(["gn:page:expired-page"]);
    expect(HostAdapter.db.get("gn:page:expired-page")).toBeNull();
    expect(HostAdapter.db.get("gn:recovery-wal:expired-page")).not.toBeNull();
    expect(HostAdapter.db.get("gn:page:recent-trash")).not.toBeNull();
  } finally {
    HostAdapter.db.remove = originalRemove;
  }
});

test("两次加载间外部数据更改后能重新读取到最新数据", () => {
  const initialPage: Page = {
    id: "page-refresh",
    workspaceId: "ws-default",
    title: "Initial Title",
    content: [],
    createdAt: 1000,
    updatedAt: 1000,
    isFolder: false,
  };
  saveInternalPage(initialPage);
  saveLocalPageMeta({
    id: "page-refresh",
    workspaceId: "ws-default",
    updatedAt: 1000,
    isFavorite: false,
  });

  const firstLoad = loadPagesFromStorage();
  expect(firstLoad.pages["page-refresh"]?.title).toBe("Initial Title");
  expect(firstLoad.localPageMetas["page-refresh"]?.isFavorite).toBeUndefined();

  // 模拟外部/跨窗修改
  HostAdapter.db.put("gn:page:page-refresh", {
    ...initialPage,
    title: "Updated Externally",
    updatedAt: 2000,
  });
  HostAdapter.db.put("gn:local-meta:page-refresh", {
    pageId: "page-refresh",
    workspaceId: "ws-default",
    updatedAt: 2000,
    isFavorite: true,
  });

  const secondLoad = loadPagesFromStorage();
  expect(secondLoad.pages["page-refresh"]?.title).toBe("Updated Externally");
  expect(secondLoad.localPageMetas["page-refresh"]?.isFavorite).toBe(true);
});

test("底层抛错时错误行为不被吞没或静默改变", () => {
  const originalAllDocs = HostAdapter.db.allDocs.bind(HostAdapter.db);
  HostAdapter.db.allDocs = () => {
    throw new Error("storage disk read failure");
  };

  try {
    expect(() => loadPagesFromStorage()).toThrow("storage disk read failure");
  } finally {
    HostAdapter.db.allDocs = originalAllDocs;
  }
});
