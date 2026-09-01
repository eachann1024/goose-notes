/**
 * Electron 桌面端的 window.gooseFs 同构实现。
 *
 * 经 window.gooseDesktop（preload contextBridge）实现 GooseFs 契约，
 * 让 local-folder 扫描、写盘、watch、图片 assets 等既有逻辑不区分宿主直接跑。
 *
 * 仅被 src/lib/host/runtime.electron.ts 动态 import（electron 构建专属）。
 */

import { getGooseDesktop } from "./runtime";

const LAST_DIRECTORY_KEY = "goose-note:electron-last-directory";

const existsCache = new Map<string, boolean>();
const rememberExists = (path: string, value: boolean) => {
  existsCache.set(path, value);
};

const bytesToBase64 = (data: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const writeFileImpl = async (
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
    console.warn("[electron-gooseFs] writeFile 失败", path, err);
    return false;
  }
};

const dirWatchIds = new Map<string, string>();
const dirWatchCbs = new Map<string, (eventType: string, filename: string) => void>();
let fsChangeUnlisten: (() => void) | null = null;

const ensureFsChangeBridge = () => {
  if (fsChangeUnlisten) return;
  const api = getGooseDesktop();
  if (!api) return;
  fsChangeUnlisten = api.onFsChange((event) => {
    for (const [dir, cb] of dirWatchCbs) {
      const prefix = dir.endsWith("/") || dir.endsWith("\\") ? dir : `${dir}/`;
      const changed = event.path;
      if (changed !== dir && !changed.startsWith(prefix) && !changed.startsWith(`${dir}\\`)) {
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

const watchImpl = (dir: string, cb: (eventType: string, filename: string) => void) => {
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

const unwatchImpl = (dir: string) => {
  dirWatchCbs.delete(dir);
  const id = dirWatchIds.get(dir);
  dirWatchIds.delete(dir);
  if (!id) return;
  const api = getGooseDesktop();
  void api?.fsUnwatch(id).catch(() => {});
};

const writeTempFileImpl = async (
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

const cleanupTempFilesImpl = async (
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

const selectDirectoryImpl = async (): Promise<string | null> => {
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

const restoreLastDirectoryImpl = async (): Promise<string | null> => {
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

const normalizeAppName = (value: string): string =>
  value.trim().replace(/\.app$/i, "").toLowerCase();

export const electronGooseFs = {
  readDir: () => [] as unknown[],
  readDirAsync: async (dir: string) => {
    const api = getGooseDesktop();
    if (!api) return [];
    try {
      const entries = await api.fsReadDir(dir);
      rememberExists(dir, true);
      return entries.map((entry) => {
        rememberExists(entry.path, true);
        return {
          name: entry.name,
          isFile: !entry.isDirectory,
          isDirectory: entry.isDirectory,
          path: entry.path,
        };
      });
    } catch {
      return [];
    }
  },

  readFile: () => null,
  readFileAsync: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return null;
    try {
      const content = await api.fsReadText(path);
      rememberExists(path, true);
      return content;
    } catch {
      return null;
    }
  },

  readFileBase64: () => null,
  readFileBase64Async: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return null;
    try {
      const bytes = await api.fsRead(path);
      rememberExists(path, true);
      return bytesToBase64(bytes);
    } catch {
      return null;
    }
  },

  readFileStat: undefined,
  readFileStatAsync: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return { ok: false, error: "gooseDesktop 不可用", content: null };
    try {
      const content = await api.fsReadText(path);
      rememberExists(path, true);
      return { ok: true, content };
    } catch (err) {
      return { ok: false, error: toErrorMessage(err), content: null };
    }
  },

  writeFile: (path: string, content: string, encoding?: string) => {
    void writeFileImpl(path, content, encoding);
    return true;
  },
  writeFileAsync: writeFileImpl,

  exists: (path: string) => existsCache.get(path) ?? false,
  existsAsync: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      const result = await api.fsExists(path);
      rememberExists(path, result);
      return result;
    } catch {
      return false;
    }
  },

  realpathAsync: async (path: string) => path,

  watch: watchImpl,
  unwatch: unwatchImpl,

  mkdir: async (dir: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.fsMkdir(dir);
      rememberExists(dir, true);
      return true;
    } catch (err) {
      console.warn("[electron-gooseFs] mkdir 失败", dir, err);
      return false;
    }
  },

  deleteFile: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.fsRemove(path);
      rememberExists(path, false);
      return true;
    } catch {
      return false;
    }
  },

  deleteDir: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.fsRemove(path);
      rememberExists(path, false);
      return true;
    } catch {
      return false;
    }
  },

  rename: async (oldPath: string, newPath: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.fsRename(oldPath, newPath);
      rememberExists(oldPath, false);
      rememberExists(newPath, true);
      return true;
    } catch (err) {
      console.warn("[electron-gooseFs] rename 失败", oldPath, newPath, err);
      return false;
    }
  },

  writeTempFile: writeTempFileImpl,
  cleanupTempFiles: cleanupTempFilesImpl,

  selectDirectory: selectDirectoryImpl,
  restoreLastDirectory: restoreLastDirectoryImpl,

  revealItemInFolder: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.showItemInFolder(path);
      return true;
    } catch {
      return false;
    }
  },

  listAvailableOpenApps: async <T extends { appName: string; aliases?: string[] }>(
    candidates: T[],
  ): Promise<T[]> => {
    const api = getGooseDesktop();
    if (!api) return [];
    try {
      const installed = await api.listOpenApps();
      const names = new Set(installed.map((app) => normalizeAppName(app.name)));
      return candidates.filter((candidate) => {
        const aliases = candidate.aliases ?? [];
        const options = [candidate.appName, ...aliases].map(normalizeAppName);
        return options.some((name) => names.has(name));
      });
    } catch (err) {
      console.warn("[electron-gooseFs] listAvailableOpenApps 失败", err);
      return [];
    }
  },
  openWithApp: async (path: string, app: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openWithApp(app, path);
      return true;
    } catch {
      return false;
    }
  },
  openTerminalAtPath: async (path: string, _terminal?: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openTerminalAtPath(path);
      return true;
    } catch {
      return false;
    }
  },

  printHtmlToPdf: async (html: string) => {
    const api = getGooseDesktop();
    if (!api?.printHtmlToPdf) return null;
    try {
      return await api.printHtmlToPdf(html);
    } catch (err) {
      console.warn("[electron-gooseFs] printHtmlToPdf 失败", err);
      return null;
    }
  },
} as unknown as GooseFs;

export function installElectronGooseFs(): boolean {
  if (typeof window === "undefined") return false;
  if (window.gooseFs) return false;
  window.gooseFs = electronGooseFs;
  return true;
}
