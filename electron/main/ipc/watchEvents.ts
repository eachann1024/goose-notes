import { assertGitSyncWritable, isGitSyncPathLocked } from "../gitSyncLock";
import { watch, type FSWatcher, type WatchEventType } from "node:fs";
import path from "node:path";
import {
  broadcast,
  hasVisibleWindow,
  onWindowVisibilityChange,
} from "../windows";

export const watchers = new Map<string, FSWatcher>();

export const recentWrites = new Map<string, number>();

export const SELF_WRITE_SUPPRESS_MS = 1500;

export const RECENT_WRITE_SWEEP_MS = 5000;

export const WATCH_DEBOUNCE_MS = 150;

export const IGNORED_WATCH_BASENAMES = new Set(["thumbs.db", "desktop.ini"]);

export const IGNORED_WATCH_SUFFIXES = [
  ".swp",
  ".swx",
  ".tmp",
  ".crswap",
  ".part",
];

export type FsChangePayload = { path: string; type: string };

export type QueuedWatch = FsChangePayload & { lastAt: number; root: string };

export type PendingWatch = FsChangePayload & { root: string };

export const PENDING_WHILE_HIDDEN_LIMIT = 200;

export const debounceQueue = new Map<string, QueuedWatch>();

export const pendingWhileHidden = new Map<string, PendingWatch>();

export const overflowRoots = new Set<string>();

export let debounceTimer: NodeJS.Timeout | null = null;

export let visibilityHooked = false;

export function normalizeWatchPath(p: string): string {
  const resolved = path.resolve(p);
  if (process.platform === "win32" || process.platform === "darwin") {
    return resolved.toLowerCase();
  }
  return resolved;
}

export function markRecentWrite(p: string): void {
  const now = Date.now();
  for (const [key, time] of recentWrites) {
    if (now - time > RECENT_WRITE_SWEEP_MS) recentWrites.delete(key);
  }
  recentWrites.set(normalizeWatchPath(p), now);
}

export async function withSelfWriteMark(
  paths: string[],
  op: () => Promise<void>,
): Promise<void> {
  for (const p of paths) assertGitSyncWritable(p);
  for (const p of paths) markRecentWrite(p);
  try {
    await op();
  } finally {
    for (const p of paths) markRecentWrite(p);
  }
}

export function isRecentSelfWrite(p: string): boolean {
  const stamped = recentWrites.get(normalizeWatchPath(p));
  if (stamped == null) return false;
  return Date.now() - stamped < SELF_WRITE_SUPPRESS_MS;
}

export function shouldIgnoreWatchFilename(
  filename: string | Buffer | null,
): boolean {
  if (filename == null) return false;
  const relative = filename.toString();
  if (!relative) return false;
  const segments = relative.split(/[/\\]/).filter(Boolean);
  for (const segment of segments) {
    if (segment.startsWith(".")) return true;
    if (segment === "node_modules") return true;
    if (segment.startsWith("~$")) return true;
    const lower = segment.toLowerCase();
    if (IGNORED_WATCH_BASENAMES.has(lower)) return true;
    if (IGNORED_WATCH_SUFFIXES.some((suffix) => lower.endsWith(suffix)))
      return true;
  }
  return false;
}

export function scheduleWatchFlush(delayMs: number): void {
  if (debounceTimer) return;
  debounceTimer = setTimeout(flushDebouncedWatchEvents, delayMs);
  debounceTimer.unref();
}

export function enqueueWatchEvent(
  payload: FsChangePayload,
  root: string,
): void {
  debounceQueue.set(normalizeWatchPath(payload.path), {
    ...payload,
    root,
    lastAt: Date.now(),
  });
  scheduleWatchFlush(WATCH_DEBOUNCE_MS);
}

export function overflowPendingHidden(root: string): void {
  for (const pending of pendingWhileHidden.values()) {
    overflowRoots.add(pending.root);
  }
  overflowRoots.add(root);
  pendingWhileHidden.clear();
}

export function dispatchWatchEvents(events: PendingWatch[]): void {
  events = events.filter((event) => !isGitSyncPathLocked(event.path));
  if (events.length === 0) return;
  if (!hasVisibleWindow()) {
    for (const event of events) {
      if (pendingWhileHidden.size >= PENDING_WHILE_HIDDEN_LIMIT) {
        overflowPendingHidden(event.root);
        continue;
      }
      pendingWhileHidden.set(normalizeWatchPath(event.path), {
        path: event.path,
        type: event.type,
        root: event.root,
      });
    }
    return;
  }
  for (const event of events) {
    broadcast("desktop:fs-change", { path: event.path, type: event.type });
  }
}

export function flushDebouncedWatchEvents(): void {
  debounceTimer = null;
  const now = Date.now();
  const ready: PendingWatch[] = [];
  let nextDelay = Number.POSITIVE_INFINITY;
  for (const [key, item] of debounceQueue) {
    const wait = WATCH_DEBOUNCE_MS - (now - item.lastAt);
    if (wait <= 0) {
      debounceQueue.delete(key);
      ready.push({ path: item.path, type: item.type, root: item.root });
    } else {
      nextDelay = Math.min(nextDelay, wait);
    }
  }
  dispatchWatchEvents(ready);
  if (debounceQueue.size > 0) {
    scheduleWatchFlush(Math.max(1, nextDelay));
  }
}

export function flushPendingHiddenWatchEvents(): void {
  if (!hasVisibleWindow()) return;
  if (overflowRoots.size === 0 && pendingWhileHidden.size === 0) return;
  const overflowEvents: FsChangePayload[] = [...overflowRoots].map((root) => ({
    path: root,
    type: "rename",
  }));
  overflowRoots.clear();
  const events: FsChangePayload[] = [...pendingWhileHidden.values()].map(
    ({ path: eventPath, type }) => ({ path: eventPath, type }),
  );
  pendingWhileHidden.clear();
  for (const event of overflowEvents) {
    broadcast("desktop:fs-change", event);
  }
  for (const event of events) {
    broadcast("desktop:fs-change", event);
  }
}

export function createFsWatcher(
  target: string,
  listener: (
    eventType: WatchEventType,
    filename: string | Buffer | null,
  ) => void,
): FSWatcher {
  try {
    return watch(target, { recursive: true }, listener);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM") {
      console.warn(
        "[desktop:fsWatch] recursive watch unavailable on this platform, falling back to non-recursive root watch",
        target,
      );
      return watch(target, { recursive: false }, listener);
    }
    throw err;
  }
}

export function hookWindowVisibilityForWatch(): void {
  if (visibilityHooked) return;
  visibilityHooked = true;
  onWindowVisibilityChange(() => {
    if (hasVisibleWindow()) flushPendingHiddenWatchEvents();
  });
}

export function closeAllWatchers(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  debounceQueue.clear();
  pendingWhileHidden.clear();
  overflowRoots.clear();
  recentWrites.clear();
  for (const watcher of watchers.values()) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  watchers.clear();
}
