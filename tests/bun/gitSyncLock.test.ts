import { expect, test } from "bun:test";
import { assertGitSyncWritable, isGitSyncPathLocked, lockGitSyncPath, waitForGitSyncRead } from "../../electron/main/gitSyncLock";

test("sync locks cover descendants, hold reads, reject mutations and release safely", async () => {
  const unlock = lockGitSyncPath("/tmp/goose-notebook");
  expect(isGitSyncPathLocked("/tmp/goose-notebook/note.md")).toBe(true);
  expect(isGitSyncPathLocked("/tmp/goose-notebook-other/note.md")).toBe(false);
  expect(() => assertGitSyncWritable("/tmp/goose-notebook/assets/pic.png")).toThrow("正在同步");
  let readFinished = false;
  const read = waitForGitSyncRead("/tmp/goose-notebook/note.md").then(() => { readFinished = true; });
  await Promise.resolve();
  expect(readFinished).toBe(false);
  unlock();
  await read;
  expect(readFinished).toBe(true);
  expect(isGitSyncPathLocked("/tmp/goose-notebook/note.md")).toBe(false);
});
