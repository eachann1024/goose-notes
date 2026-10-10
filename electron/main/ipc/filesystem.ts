import { assertGitSyncWritable, waitForGitSyncRead } from "../gitSyncLock";
import { ipcMain, shell } from "electron";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  assertAllowed,
  ensureParentDir,
  hasUnsafeSegments,
} from "../allowlist";
import { restoreFileFromTrash } from "../trashRestore";
import { trashWithUndo, undoTrash } from "../trashUndo";
import { markRecentWrite, withSelfWriteMark } from "./watchEvents";

export function registerFilesystemIpc(undoRoot: string): void {
  ipcMain.handle("desktop:fsReadText", async (_event, p: string) => {
    const target = assertAllowed(p);
    await waitForGitSyncRead(target);
    return readFile(target, "utf8");
  });

  ipcMain.handle(
    "desktop:fsWriteText",
    async (_event, p: string, data: string) => {
      const target = assertAllowed(p);
      ensureParentDir(target);
      await withSelfWriteMark([target], () => writeFile(target, data, "utf8"));
    },
  );

  ipcMain.handle("desktop:fsRead", async (_event, p: string) => {
    const target = assertAllowed(p);
    await waitForGitSyncRead(target);
    const buf = await readFile(target);
    return new Uint8Array(buf);
  });

  ipcMain.handle(
    "desktop:fsWrite",
    async (_event, p: string, data: Uint8Array) => {
      const target = assertAllowed(p);
      ensureParentDir(target);
      await withSelfWriteMark([target], () =>
        writeFile(target, Buffer.from(data)),
      );
    },
  );

  ipcMain.handle("desktop:fsReadDir", async (_event, p: string) => {
    const target = assertAllowed(p);
    await waitForGitSyncRead(target);
    const entries = await readdir(target, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(target, entry.name),
    }));
  });

  ipcMain.handle("desktop:fsMkdir", async (_event, p: string) => {
    const target = assertAllowed(p);
    await withSelfWriteMark([target], () => mkdir(target, { recursive: true }));
  });

  ipcMain.handle("desktop:fsRealpath", async (_event, p: string) => {
    if (hasUnsafeSegments(p)) return p;
    try {
      const target = assertAllowed(p);
      return await realpath(target);
    } catch {
      try {
        return await realpath(p);
      } catch {
        return p;
      }
    }
  });

  ipcMain.handle("desktop:fsExists", async (_event, p: string) => {
    if (hasUnsafeSegments(p)) return false;
    let target: string;
    try {
      target = assertAllowed(p);
    } catch {
      return false;
    }
    await waitForGitSyncRead(target);
    try {
      await stat(target);
      return true;
    } catch (statError) {
      // 只有真正的「不存在」(ENOENT) 才该被当作路径失效。
      // iCloud Drive 等云盘目录可能尚未完全物化，stat 会瞬时抛
      // EPERM/EACCES/EBUSY，此时目录其实仍存在 —— 不应把真实存在的
      // 仓库误报成「路径失效」。用 readdir 复核一次再下结论。
      if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      try {
        await readdir(target);
        return true;
      } catch (readError) {
        return (readError as NodeJS.ErrnoException).code !== "ENOENT";
      }
    }
  });

  ipcMain.handle("desktop:fsStat", async (_event, p: string) => {
    const target = assertAllowed(p);
    await waitForGitSyncRead(target);
    const info = await stat(target);
    return {
      size: info.size,
      isDirectory: info.isDirectory(),
      mtimeMs: info.mtimeMs,
    };
  });

  ipcMain.handle(
    "desktop:fsRename",
    async (_event, from: string, to: string) => {
      const src = assertAllowed(from);
      const dest = assertAllowed(to);
      ensureParentDir(dest);
      await withSelfWriteMark([src, dest], () => rename(src, dest));
    },
  );

  ipcMain.handle("desktop:fsRemove", async (_event, p: string) => {
    const target = assertAllowed(p);
    await withSelfWriteMark([target], () => shell.trashItem(target));
  });

  ipcMain.handle("desktop:fsTrashWithUndo", async (_event, p: string) => {
    const target = assertAllowed(p);
    let token = "";
    await withSelfWriteMark([target], async () => {
      token = await trashWithUndo(target, undoRoot, (source) =>
        shell.trashItem(source),
      );
    });
    return token;
  });

  ipcMain.handle("desktop:fsUndoTrash", async (_event, token: string) => {
    if (typeof token !== "string") throw new Error("无效的撤回标识");
    const original = await undoTrash(token);
    // The destination is the original, pre-validated path; no arbitrary restore path is accepted.
    markRecentWrite(original);
    return original;
  });

  ipcMain.handle("desktop:restoreFromTrash", async (_event, p: string) => {
    const dest = assertAllowed(p);
    assertGitSyncWritable(dest);
    ensureParentDir(dest);
    return restoreFileFromTrash(dest);
  });
}
