import { expect, test } from "playwright/test";
import {
  acknowledgeRecoveryEntry,
  canApplyRecoveryEntry,
  getRecoveryEntry,
  listRecoveryEntries,
  moveRecoveryEntry,
  RECOVERY_JOURNAL_STORAGE_KEY,
  recordRecoveryEntry,
} from "../../src/lib/storage/recoveryJournal";
import { getContentSignature } from "../../src/components/editor/utils/blocknote-content";
import { HostAdapter } from "../../src/lib/host/adapter";
import { recoverQuickNoteDrafts } from "../../src/stores/useQuickNote";
import { setDbStorageItem } from "../../src/lib/storage/localDbStorage";
import { installElectronLocalStorageRuntime } from "./electronLocalStorageRuntime";

function installStorageRuntime(options?: { failStorageWrites?: boolean }) {
  return installElectronLocalStorageRuntime({
    failPut: (id) =>
      Boolean(options?.failStorageWrites) &&
      (id.startsWith("gn:storage:") || id.startsWith("gn:recovery:")),
  });
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

test("连续未 ACK 编辑固定使用首次持久化基线", () => {
  installStorageRuntime();
  const persisted = [{ type: "paragraph", content: "persisted" }] as any;
  const firstEdit = [{ type: "paragraph", content: "first" }] as any;
  const latestEdit = [{ type: "paragraph", content: "latest" }] as any;
  recordRecoveryEntry({
    source: "internal-page",
    id: "baseline-page",
    content: firstEdit,
    baseSignature: getContentSignature(persisted),
    baseUpdatedAt: 10,
  });
  const latest = recordRecoveryEntry({
    source: "internal-page",
    id: "baseline-page",
    content: latestEdit,
    baseSignature: getContentSignature(firstEdit),
    baseUpdatedAt: 20,
  });

  expect(latest?.revision).toBe(2);
  expect(latest?.baseSignature).toBe(getContentSignature(persisted));
  expect(latest?.baseUpdatedAt).toBe(10);
  expect(canApplyRecoveryEntry(latest!, persisted, 10)).toBe(true);
  expect(canApplyRecoveryEntry(latest!, firstEdit, 20)).toBe(false);
});

test("惰性基线首次求值、连续编辑跳过、ACK 后重新求值", () => {
  installStorageRuntime();
  let calls = 0;
  const input = {
    source: "internal-page" as const,
    id: "lazy-baseline",
    content: null,
    baseSignature: () => `baseline-${++calls}`,
  };
  const first = recordRecoveryEntry(input)!;
  expect(first.baseSignature).toBe("baseline-1");
  expect(calls).toBe(1);
  const second = recordRecoveryEntry(input)!;
  expect(second.baseSignature).toBe("baseline-1");
  expect(calls).toBe(1);
  expect(acknowledgeRecoveryEntry(input.source, input.id, second.revision)).toBe(true);
  const afterAck = recordRecoveryEntry(input)!;
  expect(afterAck.baseSignature).toBe("baseline-2");
  expect(afterAck.revision).toBe(second.revision + 1);
  expect(calls).toBe(2);
});

for (const conflict of ["new-entry", "ack", "missing-baseline"] as const) {
  test(`惰性基线 CAS 重试重读 previous：${conflict}`, () => {
    installStorageRuntime();
    const source = "internal-page" as const;
    const id = "lazy-cas";
    const existing = conflict === "ack"
      ? recordRecoveryEntry({ source, id, content: null, baseSignature: "original" })!
      : null;
    const put = HostAdapter.db.put;
    let attempts = 0;
    let calls = 0;
    let baseline = "before-conflict";
    HostAdapter.db.put = (docId, data, rev) => {
      attempts += 1;
      if (attempts === 1) {
        // 模拟并发窗口：首次写入前调用真实 record/ACK，再注入冲突让外层 CAS 重试。
        HostAdapter.db.put = put;
        try {
          if (existing) {
            expect(calls).toBe(0);
            expect(acknowledgeRecoveryEntry(source, id, existing.revision)).toBe(true);
          } else {
            expect(calls).toBe(1);
            recordRecoveryEntry({
              source, id, content: null,
              ...(conflict === "new-entry" ? { baseSignature: "concurrent" } : {}),
            });
          }
          baseline = "after-conflict";
        } finally {
          HostAdapter.db.put = retryPut;
        }
        return { id: docId, ok: false, error: "conflict" };
      }
      return put(docId, data, rev);
    };
    const retryPut = HostAdapter.db.put;
    try {
      const entry = recordRecoveryEntry({
        source, id, content: null,
        baseSignature: () => { calls += 1; return baseline; },
      });
      expect(attempts).toBe(2);
      expect(calls).toBe(conflict === "missing-baseline" ? 2 : 1);
      expect(entry?.revision).toBe(2);
      expect(entry?.baseSignature).toBe(
        conflict === "new-entry" ? "concurrent" : "after-conflict",
      );
      expect(getRecoveryEntry(source, id)).toEqual(entry);
    } finally {
      HostAdapter.db.put = put;
    }
  });
}

test("空基线保留原 truthy 展开语义，字符串与工厂兼容", () => {
  const { docs } = installStorageRuntime();
  const input = { source: "internal-page" as const, id: "empty-baseline", content: null };
  expect(recordRecoveryEntry({ ...input, baseSignature: "" })).not.toHaveProperty("baseSignature");
  let calls = 0;
  const empty = recordRecoveryEntry({
    ...input, baseSignature: () => { calls += 1; return ""; },
  });
  expect(calls).toBe(1);
  expect(empty).not.toHaveProperty("baseSignature");
  // 兼容已有文档显式保存空串的情况：truthy 判断与 ?? 取值不能合并。
  const docId = Array.from(docs.keys()).find((id) => id.startsWith("gn:recovery:v2:"))!;
  const doc = docs.get(docId)!;
  docs.set(docId, { ...doc, data: { version: 2, entry: { ...empty, baseSignature: "" } } });
  expect(recordRecoveryEntry({ ...input, baseSignature: "fallback" })?.baseSignature).toBe("");
  expect(recordRecoveryEntry({
    ...input, baseSignature: () => { calls += 1; return "fallback"; },
  })?.baseSignature).toBe("");
  expect(calls).toBe(2);
});

test("不同 source+id 使用独立文档，不会整包覆盖", () => {
  const { docs } = installStorageRuntime();
  recordRecoveryEntry({ source: "internal-page", id: "a", content: null });
  recordRecoveryEntry({ source: "quicknote", id: "1", content: null });

  expect(getRecoveryEntry("internal-page", "a")).not.toBeNull();
  expect(getRecoveryEntry("quicknote", "1")).not.toBeNull();
  expect(
    Array.from(docs.keys()).filter((id) => id.startsWith("gn:recovery:v2:")),
  ).toHaveLength(2);
});

test("迁移到已有墓碑时返回目标的新 revision", () => {
  installStorageRuntime();
  const target = recordRecoveryEntry({
    source: "local-file",
    id: "target",
    content: null,
  })!;
  expect(acknowledgeRecoveryEntry("local-file", "target", target.revision)).toBe(
    true,
  );
  const source = recordRecoveryEntry({
    source: "local-file",
    id: "source",
    content: [{ type: "paragraph", content: "pending" }] as any,
  })!;

  const moved = moveRecoveryEntry("local-file", "source", "target");
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  expect(moved.entry?.revision).toBeGreaterThan(target.revision);
  expect(moved.entry?.content).toEqual(source.content);
  expect(getRecoveryEntry("local-file", "source")).toBeNull();
});

test("迁移到已有恢复稿时以新 revision 返回源内容", () => {
  installStorageRuntime();
  recordRecoveryEntry({ source: "local-file", id: "source", content: null });
  recordRecoveryEntry({ source: "local-file", id: "target", content: null });
  const targetLatest = recordRecoveryEntry({
    source: "local-file",
    id: "target",
    content: [{ type: "paragraph", content: "target-old" }] as any,
  })!;

  const moved = moveRecoveryEntry("local-file", "source", "target");
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  expect(moved.entry?.revision).toBe(targetLatest.revision + 1);
  expect(moved.entry?.content).toBeNull();
});

test("旧 ACK 不会清掉已被新 record 替换的恢复稿", () => {
  installStorageRuntime();
  const first = recordRecoveryEntry({
    source: "internal-page",
    id: "racy",
    content: [{ type: "paragraph", content: "first" }] as any,
  })!;
  const latest = recordRecoveryEntry({
    source: "internal-page",
    id: "racy",
    content: [{ type: "paragraph", content: "new" }] as any,
  })!;

  expect(acknowledgeRecoveryEntry("internal-page", "racy", first.revision)).toBe(false);
  expect(getRecoveryEntry("internal-page", "racy")?.revision).toBe(latest.revision);
});

test("旧整包恢复日志会迁移为独立文档", () => {
  installStorageRuntime();
  const legacy = {
    source: "local-file" as const,
    id: "legacy-local",
    content: [{ type: "paragraph", content: "legacy draft" }] as any,
    revision: 3,
    updatedAt: 30,
    baseSignature: "disk-baseline",
  };
  expect(
    setDbStorageItem(
      RECOVERY_JOURNAL_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: { "local-file:legacy-local": legacy },
      }),
    ),
  ).toBe(true);

  expect(listRecoveryEntries("local-file")).toEqual([legacy]);
  expect(getRecoveryEntry("local-file", "legacy-local")).toEqual(legacy);
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
  expect(getRecoveryEntry("local-file", "local-1")?.content).toEqual(
    entry!.content,
  );
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

test("canApplyRecoveryEntry 传入 currentSignature 避免重复访问正文且保持语义", () => {
  const baseContent = [{ type: "paragraph", content: "baseline" }] as any;
  const baseSignature = getContentSignature(baseContent);
  const entry: RecoveryJournalEntry = {
    source: "internal-page",
    id: "p-sig-test",
    revision: 1,
    updatedAt: 100,
    baseUpdatedAt: 50,
    baseSignature,
  };

  // 1. 传入签名避免访问正文（可观测 Proxy reads 验证不触碰正文）
  let reads = 0;
  const trackedContent = new Proxy({}, {
    get(target, key, receiver) {
      reads++;
      return Reflect.get(target, key, receiver);
    },
  }) as any;

  expect(
    canApplyRecoveryEntry(entry, trackedContent, 50, baseSignature),
  ).toBe(true);
  expect(reads).toBe(0);

  // 2. 省略第四参依然正常计算并校验；独立 tracked 对象验证检测器确实被触发
  let fallbackReads = 0;
  const fallbackTrackedContent = new Proxy({}, {
    get(target, key, receiver) {
      fallbackReads++;
      return Reflect.get(target, key, receiver);
    },
  }) as any;
  expect(canApplyRecoveryEntry(entry, fallbackTrackedContent, 50)).toBe(false);
  expect(fallbackReads).toBeGreaterThan(0);

  expect(canApplyRecoveryEntry(entry, baseContent, 50)).toBe(true);
  expect(
    canApplyRecoveryEntry(
      entry,
      [{ type: "paragraph", content: "different" }] as any,
      50,
    ),
  ).toBe(false);

  // 3. 空字符串作为 currentSignature 时采用 ?? 语义（不降级到重新计算且不触碰正文）
  expect(canApplyRecoveryEntry(entry, trackedContent, 50, "")).toBe(false);
  expect(reads).toBe(0);

  // 4. 基线冲突 / 时间超前依然拒绝且不触碰正文
  expect(
    canApplyRecoveryEntry(
      entry,
      trackedContent,
      51, // currentUpdatedAt > entry.baseUpdatedAt
      baseSignature,
    ),
  ).toBe(false);
  expect(reads).toBe(0);

  expect(
    canApplyRecoveryEntry(
      entry,
      trackedContent,
      50,
      "mismatched-signature",
    ),
  ).toBe(false);
  expect(reads).toBe(0);

  // 5. 无基线旧日志正常恢复且不触碰正文
  const legacyEntry: RecoveryJournalEntry = {
    source: "internal-page",
    id: "legacy",
    revision: 1,
    updatedAt: 100,
  };
  expect(
    canApplyRecoveryEntry(legacyEntry, trackedContent, 200, "any-signature"),
  ).toBe(true);
  expect(reads).toBe(0);
});
