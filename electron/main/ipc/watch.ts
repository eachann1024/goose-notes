import { ipcMain } from "electron";
import { type WatchEventType } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertAllowed } from "../allowlist";
import {
  watchers,
  isRecentSelfWrite,
  shouldIgnoreWatchFilename,
  enqueueWatchEvent,
  createFsWatcher,
} from "./watchEvents";

export function registerWatchIpc(): void {
  ipcMain.handle("desktop:fsWatch", async (_event, p: string) => {
    const target = assertAllowed(p);
    const id = randomUUID();
    const listener = (
      eventType: WatchEventType,
      filename: string | Buffer | null,
    ) => {
      if (shouldIgnoreWatchFilename(filename)) return;
      const changed = filename
        ? path.join(target, filename.toString())
        : target;
      const resolved = path.resolve(changed);
      if (isRecentSelfWrite(resolved)) return;
      enqueueWatchEvent({ path: resolved, type: eventType }, target);
    };
    try {
      const watcher = createFsWatcher(target, listener);
      watcher.on("error", (err) => {
        console.warn("[desktop:fsWatch] watcher error", target, err);
      });
      watchers.set(id, watcher);
    } catch (err) {
      console.warn("[desktop:fsWatch] failed to start watcher", target, err);
      const detail =
        err instanceof Error && err.message ? err.message : String(err);
      throw new Error(`无法监视目录: ${detail}`, { cause: err });
    }
    return id;
  });

  ipcMain.handle("desktop:fsUnwatch", async (_event, id: string) => {
    const watcher = watchers.get(id);
    watchers.delete(id);
    try {
      watcher?.close();
    } catch {
      // ignore
    }
  });
}
