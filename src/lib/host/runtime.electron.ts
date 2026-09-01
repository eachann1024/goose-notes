/**
 * Electron 桌面端（仅本地模式）的 HostRuntime 实现。
 *
 * 数据只落本机：db / dbStorage 走 localStorage（与 runtime.utools.ts 的
 * web 兜底同构）；附件走 userData/attachments 磁盘（@/lib/electron/attachments，
 * 上限 50MB）。无账号、无 sublist、无 redirect。全局热键走
 * @/lib/electron/globalHotkeys。本地文件夹能力由 ensureGooseFs 注入的
 * window.gooseFs（@/lib/electron/gooseFs，基于 window.gooseDesktop）提供。
 *
 * 仅在 GOOSE_BUILD_TARGET=electron 构建里经 @host-runtime alias 进入依赖图。
 */
import type {
  HostDoc,
  HostRuntime,
  HostPutResult,
  HostRemoveResult,
} from "./types";
import { getGooseDesktop } from "@/lib/electron/runtime";

const WEB_DB_STORAGE_KEY = "goose-note:web-db";

const readWebDb = (): Record<string, HostDoc<unknown>> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WEB_DB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeWebDb = (db: Record<string, HostDoc<unknown>>): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEB_DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
};

const nextWebRev = (current?: string): string => {
  const rev = Number(String(current || "0").split("-")[0] || 0) + 1;
  return `${rev}-${Date.now().toString(36)}`;
};

const electronAttachments = () => import("@/lib/electron/attachments");

export const hostRuntime: HostRuntime = {
  kind: "electron",
  isUTools: false,
  supportsSublist: false,
  supportsWakeHotkey: true,
  ensureGooseFs: async () => {
    if (typeof window === "undefined" || window.gooseFs) return;
    try {
      const { installElectronGooseFs } = await import("@/lib/electron/gooseFs");
      installElectronGooseFs();
      const { migrateLegacyAttachments } = await import("@/lib/electron/attachments");
      void migrateLegacyAttachments();
    } catch (err) {
      console.warn("[runtime.electron] gooseFs 注入失败", err);
    }
  },
  dbStorage: {
    getItem: (key: string) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
    removeItem: (key: string) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  },
  db: {
    put: <T>(id: string, data: T, rev?: string): HostPutResult => {
      const db = readWebDb();
      const nextRev = nextWebRev(rev || db[id]?._rev);
      db[id] = { _id: id, _rev: nextRev, data };
      writeWebDb(db);
      return { id, ok: true, rev: nextRev };
    },
    get: <T>(id: string): HostDoc<T> | null => {
      return (readWebDb()[id] as HostDoc<T> | undefined) ?? null;
    },
    remove: (id: string): HostRemoveResult => {
      const db = readWebDb();
      delete db[id];
      writeWebDb(db);
      void electronAttachments()
        .then((mod) => mod.removeAttachment(id))
        .catch(() => {});
      return { id, ok: true };
    },
    allDocs: <T>(prefix = ""): Array<HostDoc<T>> => {
      return Object.values(readWebDb()).filter((doc) =>
        doc._id.startsWith(prefix),
      ) as Array<HostDoc<T>>;
    },
    postAttachment: async (id: string, data: Uint8Array, type: string) => {
      const mod = await electronAttachments();
      return mod.postAttachment(id, data, type);
    },
    getAttachment: async (id: string) => {
      const mod = await electronAttachments();
      return mod.getAttachment(id);
    },
    getAttachmentType: async (id: string) => {
      const mod = await electronAttachments();
      return mod.getAttachmentType(id);
    },
  },
  getUser: () => null,
  copyToClipboard: (text: string) => {
    const api = getGooseDesktop();
    if (api) {
      void api.writeText(text).catch(() => {});
      return;
    }
    void navigator.clipboard?.writeText(text).catch(() => {});
  },
  showNotification: (body: string) => {
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
  openUrl: async (url: string) => {
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
  openPath: async (targetPath: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openPath(targetPath);
      return true;
    } catch {
      return false;
    }
  },
  setSublistFn: () => {},
  setExpendHeight: () => false,
  redirect: () => false,
  registerWakeHotkey: async (shortcut: string) => {
    const { registerDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    return registerDesktopGlobalHotkey("wake", shortcut);
  },
  unregisterWakeHotkey: async () => {
    const { unregisterDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    await unregisterDesktopGlobalHotkey("wake");
  },
  registerSearchHotkey: async (shortcut: string) => {
    const { registerDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    return registerDesktopGlobalHotkey("search", shortcut);
  },
  unregisterSearchHotkey: async () => {
    const { unregisterDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    await unregisterDesktopGlobalHotkey("search");
  },
  registerQuicknoteHotkey: async (shortcut: string) => {
    const { registerDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    return registerDesktopGlobalHotkey("quicknote", shortcut);
  },
  unregisterQuicknoteHotkey: async () => {
    const { unregisterDesktopGlobalHotkey } = await import(
      "@/lib/electron/globalHotkeys"
    );
    await unregisterDesktopGlobalHotkey("quicknote");
  },
};
