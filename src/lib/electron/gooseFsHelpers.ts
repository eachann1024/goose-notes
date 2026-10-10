/**
 * Electron 桌面端的 window.gooseFs 同构实现。
 *
 * 经 window.gooseDesktop（preload contextBridge）实现 GooseFs 契约，
 * 让 local-folder 扫描、写盘、watch、图片 assets 等既有逻辑不区分宿主直接跑。
 *
 * 仅被 src/lib/host/runtime.electron.ts 动态 import（electron 构建专属）。
 */

import { getGooseDesktop } from "./runtime";
import {
  rememberDiskWriteFailure,
  toDiskWriteError,
} from "@/lib/diskWriteError";

const LAST_DIRECTORY_KEY = "goose-note:electron-last-directory";

export const existsCache = new Map<string, boolean>();
export const rememberExists = (path: string, value: boolean) => {
  existsCache.set(path, value);
};

export const bytesToBase64 = (data: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
};

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const writeFileImpl = async (
  path: string,
  content: string,
  encoding?: string,
): Promise<boolean> => {
  const api = getGooseDesktop();
  if (!api) return false;
  try {
    if (encoding === "base64") {
      await api.fsWrite(path, base64ToBytes(content));
    } else {
      await api.fsWriteText(path, content);
    }
    rememberExists(path, true);
    return true;
  } catch (err) {
    const diskError = toDiskWriteError(err, path);
    rememberDiskWriteFailure(diskError);
    console.warn("[electron-gooseFs] writeFile 失败", path, err);
    return false;
  }
};

const dirWatchIds = new Map<string, string>();
const dirWatchCbs = new Map<
  string,
  (eventType: string, filename: string) => void
>();
let fsChangeUnlisten: (() => void) | null = null;

const ensureFsChangeBridge = () => {
  if (fsChangeUnlisten) return;
  const api = getGooseDesktop();
  if (!api) return;
  fsChangeUnlisten = api.onFsChange((event) => {
    for (const [dir, cb] of dirWatchCbs) {
      const prefix = dir.endsWith("/") || dir.endsWith("\\") ? dir : `${dir}/`;
      const changed = event.path;
      if (
        changed !== dir &&
        !changed.startsWith(prefix) &&
        !changed.startsWith(`${dir}\\`)
      ) {
        continue;
      }
      const filename = changed.startsWith(prefix)
        ? changed.slice(prefix.length)
        : changed.startsWith(`${dir}\\`)
          ? changed.slice(dir.length + 1)
          : changed === dir
            ? ""
            : changed;
      const eventType = event.type === "rename" ? "rename" : "change";
      if (!filename && changed === dir) continue;
      try {
        cb(eventType, filename || changed);
      } catch {
        // ignore
      }
      window.dispatchEvent(
        new CustomEvent("goose-note:file-changed", {
          detail: { eventType, filename: filename || changed, dirPath: dir },
        }),
      );
    }
  });
};

export const watchImpl = (
  dir: string,
  cb: (eventType: string, filename: string) => void,
) => {
  if (dirWatchIds.has(dir)) return null;
  dirWatchCbs.set(dir, cb);
  void (async () => {
    const api = getGooseDesktop();
    if (!api) return;
    try {
      ensureFsChangeBridge();
      const id = await api.fsWatch(dir);
      dirWatchIds.set(dir, id);
    } catch (err) {
      console.warn("[electron-gooseFs] watch 失败", dir, err);
    }
  })();
  return null;
};

export const unwatchImpl = (dir: string) => {
  dirWatchCbs.delete(dir);
  const id = dirWatchIds.get(dir);
  dirWatchIds.delete(dir);
  if (!id) return;
  const api = getGooseDesktop();
  void api?.fsUnwatch(id).catch(() => {});
};

export const writeTempFileImpl = async (
  relativePath: string,
  contentBase64: string,
): Promise<string | null> => {
  const api = getGooseDesktop();
  if (!api) return null;
  try {
    const base = await api.getUserDataPath();
    const segments = relativePath.split("/").filter(Boolean);
    const target = await api.joinPath(base, ...segments);
    const parent = await api.joinPath(base, ...segments.slice(0, -1));
    await api.fsMkdir(parent);
    await api.fsWrite(target, base64ToBytes(contentBase64));
    return target;
  } catch (err) {
    console.warn("[electron-gooseFs] writeTempFile 失败", relativePath, err);
    return null;
  }
};

export const cleanupTempFilesImpl = async (
  prefix: string,
  maxAgeMs: number,
): Promise<void> => {
  const api = getGooseDesktop();
  if (!api) return;
  try {
    const base = await api.joinPath(
      await api.getUserDataPath(),
      ...prefix.split("/").filter(Boolean),
    );
    const entries = await api.fsReadDir(base);
    const now = Date.now();
    for (const entry of entries) {
      try {
        const info = await api.fsStat(entry.path);
        if (info.mtimeMs > 0 && now - info.mtimeMs > maxAgeMs) {
          await api.fsRemove(entry.path);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
};

export const selectDirectoryImpl = async (): Promise<string | null> => {
  const api = getGooseDesktop();
  if (!api) return null;
  try {
    const dir = await api.selectDirectory();
    if (!dir) return null;
    try {
      window.localStorage.setItem(LAST_DIRECTORY_KEY, dir);
    } catch {
      // ignore
    }
    rememberExists(dir, true);
    return dir;
  } catch (err) {
    console.warn("[electron-gooseFs] selectDirectory 失败", err);
    return null;
  }
};

export const restoreLastDirectoryImpl = async (): Promise<string | null> => {
  const api = getGooseDesktop();
  if (!api) return null;
  try {
    const dir = window.localStorage.getItem(LAST_DIRECTORY_KEY);
    if (!dir) return null;
    if (await api.fsExists(dir)) {
      rememberExists(dir, true);
      return dir;
    }
    return null;
  } catch {
    return null;
  }
};

export const normalizeAppName = (value: string): string =>
  value
    .trim()
    .replace(/\.app$/i, "")
    .toLowerCase();
