import { assertGitSyncWritable } from "./gitSyncLock";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, cp, lstat, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const pending = new Map<string, { original: string; backup: string; timer: NodeJS.Timeout }>();
const RETAIN_MS = 10 * 60_000;

/** Keep an exact, short-lived copy because Electron's trashItem does not return a restore URL. */
export async function trashWithUndo(
  original: string,
  backupRoot: string,
  trash: (source: string) => Promise<void>,
): Promise<string> {
  const token = randomUUID();
  const backupDir = path.join(backupRoot, token);
  const backup = path.join(backupDir, "item");
  await mkdir(backupDir, { recursive: true });
  try {
    await cp(original, backup, { recursive: true, preserveTimestamps: true });
    await trash(original);
  } catch (error) {
    await rm(backupDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  // ponytail: an undo copy is retained for 10 minutes; a native trash URL would avoid duplicate disk use.
  const timer = setTimeout(() => {
    pending.delete(token);
    void rm(backupDir, { recursive: true, force: true });
  }, RETAIN_MS);
  timer.unref();
  pending.set(token, { original, backup, timer });
  return token;
}

export async function undoTrash(token: string): Promise<string> {
  const item = pending.get(token);
  if (!item) throw new Error("撤回已过期，请从系统废纸篓恢复");
  const { original, backup, timer } = item;
  assertGitSyncWritable(original);
  clearTimeout(timer);
  // Keep the backup if restoration fails, so a conflict can be resolved and retried.
  try {
    try {
      await lstat(original);
      throw new Error("原位置已有同名文件，未覆盖；请先处理冲突");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const backupInfo = await lstat(backup);
    if (backupInfo.isDirectory()) {
      await mkdir(original); // exclusive: never merge into an existing folder
      for (const child of await readdir(backup)) {
        await cp(path.join(backup, child), path.join(original, child), {
          recursive: true, force: false, errorOnExist: true, preserveTimestamps: true,
        });
      }
    } else {
      // Exclusive creation prevents overwriting a file written after deletion.
      if (backupInfo.isSymbolicLink()) {
        await cp(backup, original, { force: false, errorOnExist: true });
      } else {
        await copyFile(backup, original, constants.COPYFILE_EXCL);
      }
    }
    pending.delete(token);
    void rm(path.dirname(backup), { recursive: true, force: true });
    return original;
  } catch (error) {
    item.timer = setTimeout(() => {
      pending.delete(token);
      void rm(path.dirname(backup), { recursive: true, force: true });
    }, RETAIN_MS);
    item.timer.unref();
    throw error;
  }
}

export async function cleanupOldTrashUndoCopies(root: string): Promise<void> {
  for (const entry of await readdir(root).catch(() => [])) {
    if (!/^[0-9a-f-]{36}$/i.test(entry)) continue;
    const dir = path.join(root, entry);
    if (Date.now() - (await stat(dir)).mtimeMs > 24 * 60 * 60_000) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
