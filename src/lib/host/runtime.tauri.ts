import { tauriGooseFs } from "./tauri-goose-fs";
import type { HostDoc, HostPutResult, HostRemoveResult, HostRuntime } from "./types";

const readDoc = <T>(id: string): HostDoc<T> | null => {
  const item = localStorage.getItem(id);
  if (!item) return null;
  try {
    return JSON.parse(item) as HostDoc<T>;
  } catch {
    return null;
  }
};

const putDoc = <T>(id: string, data: T, rev?: string): HostPutResult => {
  try {
    const doc = { _id: id, _rev: rev || Date.now().toString(), data };
    localStorage.setItem(id, JSON.stringify(doc));
    return { id, ok: true, rev: doc._rev };
  } catch (error) {
    return { id, ok: false, error };
  }
};

const removeDoc = (id: string): HostRemoveResult => {
  localStorage.removeItem(id);
  return { id, ok: true };
};

const allDocs = <T>(prefix = ""): Array<HostDoc<T>> => {
  const docs: Array<HostDoc<T>> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const doc = readDoc<T>(key);
    if (doc) docs.push(doc);
  }
  return docs;
};

const ensureNotificationPermission = async () => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore permission errors
    }
  }
};

const normalizeShortcut = (shortcut: string) =>
  shortcut.replace(/CmdOrCtrl|CmdOrControl/gi, "CommandOrControl");

const focusMainWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const currentWindow = getCurrentWindow();
  await currentWindow.unminimize();
  await currentWindow.show();
  await currentWindow.setFocus();
};

const registerGlobalShortcut = async (
  shortcut: string,
  onPressed?: () => Promise<void> | void,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const normalizedShortcut = normalizeShortcut(shortcut);
    const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
    await unregister(normalizedShortcut).catch(() => {});

    await register(normalizedShortcut, (event) => {
      if (event.state !== "Pressed") return;
      void (async () => {
        await focusMainWindow();
        if (onPressed) {
          await onPressed();
        }
      })();
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
};

const unregisterGlobalShortcut = async (shortcut: string): Promise<void> => {
  try {
    const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
    await unregister(normalizeShortcut(shortcut));
  } catch {
    // ignore unregister failures on cleanup
  }
};

export const hostRuntime: HostRuntime = {
  kind: "tauri",
  isUTools: false,
  isTauri: true,
  supportsSublist: false,
  supportsWakeHotkey: true,
  ensureGooseFs: async () => {
    if (typeof window === "undefined") return;
    window.gooseFs = tauriGooseFs;
    await tauriGooseFs.restoreLastDirectory?.();
  },
  db: {
    put: putDoc,
    get: readDoc,
    remove: removeDoc,
    allDocs,
  },
  getUser: () => ({
    nickname: "Tauri User",
    avatar: undefined,
    type: "tauri",
  }),
  copyToClipboard: (text: string) => {
    void navigator.clipboard.writeText(text);
  },
  showNotification: (body: string) => {
    void ensureNotificationPermission().then(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("鹅的笔记", { body });
      } else {
        console.log("Notification:", body);
      }
    });
  },
  openUrl: async (url: string) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch (error) {
      console.error("[host/tauri] openUrl failed:", error);
      window.open(url, "_blank");
    }
  },
  setSublistFn: () => {},
  setExpendHeight: () => false,
  redirect: () => false,
  registerWakeHotkey: async (shortcut: string) =>
    registerGlobalShortcut(shortcut),
  unregisterWakeHotkey: async (shortcut: string) =>
    unregisterGlobalShortcut(shortcut),
  registerSearchHotkey: async (shortcut: string) =>
    registerGlobalShortcut(shortcut, async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      window.dispatchEvent(new CustomEvent("goose-note:open-search"));
    }),
  unregisterSearchHotkey: async (shortcut: string) =>
    unregisterGlobalShortcut(shortcut),
};
