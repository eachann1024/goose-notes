/**
 * Electron 桌面端（仅本地模式）的 EditorPlatform 实现。
 *
 * fs / dialog 的目录选择复用 src/lib/utools/fs.ts、dialogs.ts —— 它们读
 * window.gooseFs，由 runtime.electron.ts 的 ensureGooseFs 在启动时注入。
 * shell / clipboard / ai.customFetch 走 window.gooseDesktop。
 */
import type {
  DirEntry,
  EditorPlatform,
  EditorPlatformAi,
  EditorPlatformClipboard,
  EditorPlatformDialog,
  EditorPlatformFs,
  EditorPlatformImageStorage,
  EditorPlatformShell,
  FileStat,
  FsWatchEvent,
} from "@/components/editor/platform/types";
import { fs as hostFs } from "@/lib/utools/fs";
import { dialogs as hostDialogs } from "@/lib/utools/dialogs";
import { imageStorage as appImageStorage } from "@/lib/imageStorage";
import { resolveImageRefToUrl } from "@/lib/imageStorage/resolveUrl";
import { getGooseDesktop } from "@/lib/electron/runtime";

const fs: EditorPlatformFs = {
  isAvailable: () => hostFs.isAvailable(),
  readFileAsync: (path) => hostFs.readFileAsync(path),
  readFileStatAsync: async (path): Promise<FileStat | null> => {
    const raw = await hostFs.readFileStatAsync(path);
    if (!raw) return null;
    return raw as unknown as FileStat;
  },
  readFileBase64: async (path) => {
    const gfs =
      typeof window !== "undefined" ? (window.gooseFs ?? null) : null;
    if (!gfs) return null;
    try {
      const asyncReader = (
        gfs as GooseFs & {
          readFileBase64Async?: (p: string) => Promise<string | null>;
        }
      ).readFileBase64Async;
      if (typeof asyncReader === "function") return await asyncReader(path);
      if (typeof gfs.readFileBase64 === "function") {
        return (gfs.readFileBase64(path) as string | null) ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },
  writeFileAsync: (path, content, encoding) =>
    hostFs.writeFileAsync(path, content, encoding),
  writeTempFile: (relativePath, contentBase64) =>
    hostFs.writeTempFile(relativePath, contentBase64),
  cleanupTempFiles: (prefix, maxAgeMs) =>
    hostFs.cleanupTempFiles(prefix, maxAgeMs),
  existsAsync: (path) => hostFs.existsAsync(path),
  mkdir: (path) => hostFs.mkdir(path),
  readDirAsync: async (path): Promise<DirEntry[]> =>
    (await hostFs.readDirAsync(path)) as DirEntry[],
  deleteFile: (path) => hostFs.deleteFile(path),
  deleteDir: (path) => hostFs.deleteDir(path),
  rename: (oldPath, newPath) => hostFs.rename(oldPath, newPath),
  watch: (path, cb: (e: FsWatchEvent) => void) => {
    hostFs.watch(path, cb as (event: FsWatchEvent) => void);
    return () => hostFs.unwatch(path);
  },
  revealItemInFolder: (path) => hostFs.revealItemInFolder(path),
};

const shell: EditorPlatformShell = {
  openPath: async (targetPath) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openPath(targetPath);
      return true;
    } catch {
      return false;
    }
  },
  showItemInFolder: async (targetPath) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.showItemInFolder(targetPath);
      return true;
    } catch {
      return false;
    }
  },
  openUrl: async (url) => {
    const api = getGooseDesktop();
    if (api) {
      try {
        await api.openUrl(url);
        return;
      } catch {
        // fall through
      }
    }
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // noop
    }
  },
  showNotification: (body) => {
    const api = getGooseDesktop();
    if (api) {
      void api.notify({ title: "Goose Note", body }).catch(() => {});
      return;
    }
    try {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") {
        new Notification(body);
        return;
      }
      if (Notification.permission !== "denied") {
        void Notification.requestPermission().then((permission) => {
          if (permission === "granted") new Notification(body);
        });
      }
    } catch {
      // noop
    }
  },
  getDownloadsPath: async () => {
    const api = getGooseDesktop();
    if (!api) return null;
    try {
      return await api.getDownloadsPath();
    } catch {
      return null;
    }
  },
};

const imageStorage: EditorPlatformImageStorage = {
  save: (blob, mimeType) => appImageStorage.save(blob, mimeType),
  load: (ref) => appImageStorage.load(ref),
  delete: (ref) => appImageStorage.delete(ref),
  resolveRefToUrl: (ref, pageLocalFilePath) =>
    resolveImageRefToUrl(ref, pageLocalFilePath),
};

const dialog: EditorPlatformDialog = {
  showSaveDialog: async (options) => {
    const api = getGooseDesktop();
    if (!api) return null;
    try {
      return await api.showSaveDialog({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
    } catch {
      return null;
    }
  },
  showOpenDialog: async (options) => {
    const api = getGooseDesktop();
    if (!api) return null;
    try {
      return await api.showOpenDialog({
        filters: options?.filters,
        multiple: options?.multiSelections ?? false,
      });
    } catch {
      return null;
    }
  },
  selectDirectory: () => hostDialogs.selectDirectory(),
  restoreLastDirectory: () => hostDialogs.restoreLastDirectory(),
};

const clipboard: EditorPlatformClipboard = {
  copyText: async (text) => {
    const api = getGooseDesktop();
    if (api) {
      try {
        await api.writeText(text);
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard?.writeText(text);
  },
  copyImage: async (dataUrl) => {
    const api = getGooseDesktop();
    if (api?.writeImage) {
      try {
        await api.writeImage(dataUrl);
        return;
      } catch {
        // fall through
      }
    }
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      throw new Error("当前系统不支持复制图片。");
    }
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || "image/png"]: blob }),
    ]);
  },
  readText: async () => {
    const api = getGooseDesktop();
    if (api) {
      try {
        return (await api.readText()) ?? "";
      } catch {
        // fall through
      }
    }
    return (await navigator.clipboard?.readText()) ?? "";
  },
};

const headerRecord = (headers?: HeadersInit): Record<string, string> | undefined => {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
};

const ai: EditorPlatformAi = {
  customFetch: (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const api = getGooseDesktop();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!api) return fetch(input, init);
    let body: string | undefined;
    if (typeof init?.body === "string") body = init.body;
    else if (init?.body != null) body = String(init.body);
    const result = await api.netFetch(url, {
      method: init?.method,
      headers: headerRecord(init?.headers),
      body,
    });
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  }) as typeof fetch,
};

export const electronEditorPlatform: EditorPlatform = {
  fs,
  shell,
  imageStorage,
  dialog,
  clipboard,
  ai,
};
