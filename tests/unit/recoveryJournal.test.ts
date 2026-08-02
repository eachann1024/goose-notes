import { expect, test } from "playwright/test";
import {
  acknowledgeRecoveryEntry,
  canApplyRecoveryEntry,
  getRecoveryEntry,
  recordRecoveryEntry,
} from "../../src/lib/storage/recoveryJournal";
import { getContentSignature } from "../../src/components/editor/utils/blocknote-content";
import { recoverQuickNoteDrafts } from "../../src/stores/useQuickNote";

function installStorageRuntime(options?: { failStorageWrites?: boolean }) {
  let rev = 0;
  const docs = new Map<string, { _id: string; _rev: string; data: unknown }>();
  (globalThis as any).window = {
    utools: {
      db: {
        get: (id: string) => docs.get(id) ?? null,
        put: (doc: { _id: string; _rev?: string; data: unknown }) => {
          if (options?.failStorageWrites && doc._id.startsWith("gn:storage:")) {
            return { id: doc._id, ok: false, error: "fault-injected" };
          }
          const nextRev = `rev-${++rev}`;
          docs.set(doc._id, { ...doc, _rev: nextRev });
          return { id: doc._id, ok: true, rev: nextRev };
        },
        remove: (id: string) => {
          docs.delete(id);
          return { id, ok: true };
        },
        allDocs: () => [],
      },
    },
  };
}

test.afterEach(() => delete (globalThis as any).window);

test("旧版 ACK 不会清掉更新的恢复稿", () => {
  installStorageRuntime();
  const first = recordRecoveryEntry({
    source: "internal-page",
    id: "p1",
    content: [{ type: "paragraph", content: "first" }] as any,
  });
  const second = recordRecoveryEntry({
    source: "internal-page",
    id: "p1",
    content: [{ type: "paragraph", content: "second" }] as any,
  });

  expect(first?.revision).toBe(1);
  expect(second?.revision).toBe(2);
  expect(acknowledgeRecoveryEntry("internal-page", "p1", 1)).toBe(false);
  expect(getRecoveryEntry("internal-page", "p1")?.revision).toBe(2);
  expect(acknowledgeRecoveryEntry("internal-page", "p1", 2)).toBe(true);
  expect(getRecoveryEntry("internal-page", "p1")).toBeNull();
});

test("恢复稿不会覆盖已经变化的外部文件版本", () => {
  installStorageRuntime();
  const original = [{ type: "paragraph", content: "disk-old" }] as any;
  const entry = recordRecoveryEntry({
    source: "local-file",
    id: "local-1",
    content: [{ type: "paragraph", content: "unsaved" }] as any,
    baseSignature: getContentSignature(original),
  });
  expect(entry).not.toBeNull();
  expect(canApplyRecoveryEntry(entry!, original)).toBe(true);
  expect(
    canApplyRecoveryEntry(
      entry!,
      [{ type: "paragraph", content: "disk-new" }] as any,
    ),
  ).toBe(false);
});

test("速记从独立恢复日志找回当前草稿，且不淘汰草稿正文", () => {
  installStorageRuntime();
  const previous = [{ type: "paragraph", content: "before" }] as any;
  const latest = [{ type: "paragraph", content: "latest" }] as any;
  recordRecoveryEntry({
    source: "quicknote",
    id: "3",
    content: latest,
    baseSignature: getContentSignature(previous),
  });

  const recovered = recoverQuickNoteDrafts({ 3: previous });
  expect(recovered.recoveredSlots).toEqual([3]);
  expect(recovered.conflictSlots).toEqual([]);
  expect(recovered.drafts[3]).toEqual(latest);
});

test("恢复日志写入故障会向调用方返回失败", () => {
  installStorageRuntime({ failStorageWrites: true });
  expect(
    recordRecoveryEntry({
      source: "internal-page",
      id: "p1",
      content: null,
    }),
  ).toBeNull();
});
