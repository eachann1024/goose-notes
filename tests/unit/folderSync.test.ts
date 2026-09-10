import { expect, test } from "playwright/test";
import type { JSONContent } from "../../src/types";
import type { PagesState } from "../../src/stores/pages/types";
import {
  clearLocalSaveTimers,
  confirmRecoveredLocalSave,
  discardPendingLocalSave,
  flushAllPendingLocalSavesInternal,
  flushPendingLocalSaveByPageIdInternal,
  localSaveDebounceTimers,
  localSaveMaxWaitTimers,
  localSaveWriteChains,
  pendingLocalSaveContents,
  pendingLocalSaveRevisions,
  queueLocalPageSave,
  migratePendingLocalSave,
  isRecoveredLocalSaveConfirmationRequired,
  restorePendingLocalSave,
} from "../../src/stores/pages/folderSync";
import {
  getRecoveryEntry,
  recordRecoveryEntry,
} from "../../src/lib/storage/recoveryJournal";
import { DiskWriteError } from "../../src/lib/diskWriteError";
import {
  clearElectronLocalStorageRuntime,
  installElectronLocalStorageRuntime,
} from "./electronLocalStorageRuntime";

const PAGE_ID = "local-page";

function content(text: string): JSONContent {
  return [{ type: "paragraph", content: text }] as unknown as JSONContent;
}

function stateWithSave(
  saveLocalPageContent: PagesState["saveLocalPageContent"],
): () => PagesState {
  return () => ({ saveLocalPageContent }) as unknown as PagesState;
}

function resetFolderSyncState() {
  discardPendingLocalSave(PAGE_ID);
  for (const pageId of new Set([
    ...localSaveDebounceTimers.keys(),
    ...localSaveMaxWaitTimers.keys(),
  ])) {
    clearLocalSaveTimers(pageId);
  }
  pendingLocalSaveContents.clear();
  pendingLocalSaveRevisions.clear();
  localSaveWriteChains.clear();
  clearElectronLocalStorageRuntime();
}

function installRecoveryRuntime(failPut?: (id: string) => boolean) {
  return installElectronLocalStorageRuntime({ failPut });
}

test.beforeEach(resetFolderSyncState);
test.afterEach(resetFolderSyncState);

test("false save result keeps pending content and rejects explicit flush", async () => {
  const draft = content("not-yet-saved");
  pendingLocalSaveContents.set(PAGE_ID, draft);

  await expect(
    flushPendingLocalSaveByPageIdInternal(
      PAGE_ID,
      stateWithSave(async () => false),
    ),
  ).rejects.toThrow(`本地页面保存未完成：${PAGE_ID}`);

  expect(pendingLocalSaveContents.get(PAGE_ID)).toBe(draft);
  expect(localSaveWriteChains.has(PAGE_ID)).toBe(false);
});

test("恢复稿在未确认前不会被后台 flush 写盘", async () => {
  const recovered = content("recovered-draft");
  let attempts = 0;
  restorePendingLocalSave(PAGE_ID, recovered, 1);

  await flushAllPendingLocalSavesInternal(
    stateWithSave(async () => {
      attempts += 1;
      return true;
    }),
  );

  expect(attempts).toBe(0);
  expect(pendingLocalSaveContents.get(PAGE_ID)).toEqual(recovered);
});

test("恢复稿只在用户编辑或放弃后解除待确认状态", () => {
  restorePendingLocalSave(PAGE_ID, content("recovered-draft"), 1);
  expect(isRecoveredLocalSaveConfirmationRequired(PAGE_ID)).toBe(true);

  queueLocalPageSave(PAGE_ID, content("edited"), stateWithSave(async () => true));
  expect(isRecoveredLocalSaveConfirmationRequired(PAGE_ID)).toBe(false);

  restorePendingLocalSave(PAGE_ID, content("recovered-again"), 2);
  discardPendingLocalSave(PAGE_ID);
  expect(isRecoveredLocalSaveConfirmationRequired(PAGE_ID)).toBe(false);
});

test("显式保存恢复稿后清理待确认内容和恢复日志", () => {
  installRecoveryRuntime();
  const recovery = recordRecoveryEntry({
    source: "local-file",
    id: PAGE_ID,
    content: content("recovered-draft"),
  })!;
  restorePendingLocalSave(PAGE_ID, content("recovered-draft"), recovery.revision);

  confirmRecoveredLocalSave(PAGE_ID);

  expect(isRecoveredLocalSaveConfirmationRequired(PAGE_ID)).toBe(false);
  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
  expect(getRecoveryEntry("local-file", PAGE_ID)).toBeNull();
});

test("恢复稿在后续真实编辑后恢复正常自动保存", async () => {
  installRecoveryRuntime();
  const recovery = recordRecoveryEntry({
    source: "local-file",
    id: PAGE_ID,
    content: content("recovered-draft"),
  })!;
  restorePendingLocalSave(
    PAGE_ID,
    content("recovered-draft"),
    recovery.revision,
  );
  queueLocalPageSave(
    PAGE_ID,
    content("edited-after-recovery"),
    stateWithSave(async () => true),
    recovery.revision,
  );

  await flushAllPendingLocalSavesInternal(stateWithSave(async () => true));

  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
});

test("仅剩恢复日志确认时，后台 flush 不会伪报磁盘写入失败", async () => {
  pendingLocalSaveRevisions.set(PAGE_ID, 7);

  await flushAllPendingLocalSavesInternal(stateWithSave(async () => false));
});

test("flush 保留磁盘权限错误，而不是吞成通用保存未完成", async () => {
  const draft = content("not-yet-saved");
  pendingLocalSaveContents.set(PAGE_ID, draft);
  const diskError = new DiskWriteError(
    "仓库目录当前无法写入（权限不足）。若笔记在 iCloud 等云盘上，请先恢复云盘登录后再保存。",
    { code: "EACCES", path: "/home/eachann/iCloud/Note/a.md" },
  );

  await expect(
    flushPendingLocalSaveByPageIdInternal(
      PAGE_ID,
      stateWithSave(async () => {
        throw diskError;
      }),
    ),
  ).rejects.toThrow(diskError.message);

  expect(pendingLocalSaveContents.get(PAGE_ID)).toBe(draft);
});

test("failed save does not overwrite newer content queued during the write", async () => {
  const first = content("first");
  const newer = content("newer");
  pendingLocalSaveContents.set(PAGE_ID, first);

  await expect(
    flushPendingLocalSaveByPageIdInternal(
      PAGE_ID,
      stateWithSave(async () => {
        pendingLocalSaveContents.set(PAGE_ID, newer);
        return false;
      }),
    ),
  ).rejects.toThrow();

  expect(pendingLocalSaveContents.get(PAGE_ID)).toBe(newer);
});

test("a later explicit flush retries and clears content kept after failure", async () => {
  const draft = content("retry-me");
  let attempts = 0;
  const getState = stateWithSave(async () => {
    attempts += 1;
    return attempts > 1;
  });
  pendingLocalSaveContents.set(PAGE_ID, draft);

  await expect(
    flushPendingLocalSaveByPageIdInternal(PAGE_ID, getState),
  ).rejects.toThrow();
  await flushPendingLocalSaveByPageIdInternal(PAGE_ID, getState);

  expect(attempts).toBe(2);
  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
});

test("ACK 失败时保留 pending revision 供后续重试", async () => {
  const draft = content("saved-but-ack-failed");
  pendingLocalSaveContents.set(PAGE_ID, draft);
  pendingLocalSaveRevisions.set(PAGE_ID, 7);

  await expect(
    flushPendingLocalSaveByPageIdInternal(
      PAGE_ID,
      stateWithSave(async () => true),
    ),
  ).rejects.toThrow(`本地页面恢复日志确认未完成：${PAGE_ID}`);

  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
  expect(pendingLocalSaveRevisions.get(PAGE_ID)).toBe(7);
});

test("恢复日志迁移失败时保留旧 pageId 的 pending 状态", () => {
  installRecoveryRuntime((id) => id.endsWith(":new-id"));
  const draft = content("keep-old-id");
  const entry = recordRecoveryEntry({
    source: "local-file",
    id: "old-id",
    content: draft,
  })!;
  pendingLocalSaveContents.set("old-id", draft);
  pendingLocalSaveRevisions.set("old-id", entry.revision);
  const result = migratePendingLocalSave("old-id", "new-id", stateWithSave(async () => true));

  expect(result.ok).toBe(false);
  expect(pendingLocalSaveContents.get("old-id")).toEqual(draft);
  expect(pendingLocalSaveRevisions.get("old-id")).toBe(entry.revision);
  expect(pendingLocalSaveContents.has("new-id")).toBe(false);
  expect(getRecoveryEntry("local-file", "old-id")?.revision).toBe(entry.revision);
});

test("恢复日志迁移使用目标返回的新 revision", () => {
  installRecoveryRuntime();
  const target = recordRecoveryEntry({
    source: "local-file",
    id: "new-id",
    content: null,
  })!;
  const draft = content("move-to-tombstone");
  const source = recordRecoveryEntry({
    source: "local-file",
    id: "old-id",
    content: draft,
  })!;
  pendingLocalSaveContents.set("old-id", draft);
  pendingLocalSaveRevisions.set("old-id", source.revision);

  const result = migratePendingLocalSave("old-id", "new-id", stateWithSave(async () => true));

  expect(result.ok).toBe(true);
  const moved = getRecoveryEntry("local-file", "new-id")!;
  expect(moved.revision).toBeGreaterThan(target.revision);
  expect(pendingLocalSaveRevisions.get("new-id")).toBe(moved.revision);
  expect(pendingLocalSaveRevisions.has("old-id")).toBe(false);
});

test("discard prevents an in-flight failed save from restoring stale content", async () => {
  const draft = content("discard-me");
  let finishSave: ((saved: boolean) => void) | undefined;
  const saveResult = new Promise<boolean>((resolve) => {
    finishSave = resolve;
  });
  pendingLocalSaveContents.set(PAGE_ID, draft);

  const flush = flushPendingLocalSaveByPageIdInternal(
    PAGE_ID,
    stateWithSave(async () => saveResult),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  discardPendingLocalSave(PAGE_ID);
  finishSave?.(false);
  await expect(flush).rejects.toThrow();

  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
});

test("new edits after discard enter the normal save queue", async () => {
  discardPendingLocalSave(PAGE_ID);
  const next = content("new-edit");
  const getState = stateWithSave(async () => true);

  queueLocalPageSave(PAGE_ID, next, getState);
  await flushPendingLocalSaveByPageIdInternal(PAGE_ID, getState);

  expect(pendingLocalSaveContents.has(PAGE_ID)).toBe(false);
});

test("flush-all propagates a false save result to explicit callers", async () => {
  pendingLocalSaveContents.set(PAGE_ID, content("flush-all"));

  await expect(
    flushAllPendingLocalSavesInternal(stateWithSave(async () => false)),
  ).rejects.toThrow(`本地页面保存未完成：${PAGE_ID}`);
});

test("scheduled save consumes rejection while keeping content pending", async () => {
  const draft = content("scheduled");
  const unhandled: unknown[] = [];
  const loggedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  console.error = (...args: unknown[]) => loggedErrors.push(args);

  let attempts = 0;

  try {
    queueLocalPageSave(
      PAGE_ID,
      draft,
      stateWithSave(async () => {
        attempts += 1;
        return false;
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(unhandled).toEqual([]);
    expect(loggedErrors).toHaveLength(1);
    expect(attempts).toBe(1);
    expect(pendingLocalSaveContents.get(PAGE_ID)).toBe(draft);
    expect(localSaveDebounceTimers.has(PAGE_ID)).toBe(false);
    expect(localSaveMaxWaitTimers.has(PAGE_ID)).toBe(false);
  } finally {
    console.error = originalConsoleError;
    process.off("unhandledRejection", onUnhandled);
  }
});
