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

const bytesToBase64 = (data: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

const SHORTCUT_TOKEN_ALIASES: Record<string, string> = {
  cmdorctrl: "CommandOrControl",
  cmdorcontrol: "CommandOrControl",
  commandorcontrol: "CommandOrControl",
  cmd: "Command",
  command: "Command",
  meta: "Command",
  ctrl: "Control",
  control: "Control",
  option: "Alt",
  alt: "Alt",
  shift: "Shift",
};

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  space: "Space",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
};

const normalizeShortcutToken = (token: string) => {
  const normalized = token.trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const modifierAlias = SHORTCUT_TOKEN_ALIASES[lower];
  if (modifierAlias) return modifierAlias;

  const specialAlias = SPECIAL_KEY_ALIASES[lower];
  if (specialAlias) return specialAlias;

  if (/^f\d{1,2}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }
  if (normalized.length === 1) {
    return normalized.toUpperCase();
  }
  return normalized.slice(0, 1).toUpperCase() + normalized.slice(1);
};

const normalizeShortcut = (shortcut: string) =>
  shortcut
    .split("+")
    .map((token) => normalizeShortcutToken(token))
    .filter((token): token is string => Boolean(token))
    .join("+");

const runSilently = async (task: () => Promise<void>) => {
  try {
    await task();
  } catch {
    // ignore single-step activation failures, keep follow-up actions running
  }
};

const focusMainWindow = async () => {
  // macOS 下应用可能被隐藏，先尝试唤起 App 再聚焦窗口
  await runSilently(async () => {
    const { show } = await import("@tauri-apps/api/app");
    await show();
  });

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const currentWindow = getCurrentWindow();

  await runSilently(async () => {
    const minimized = await currentWindow.isMinimized();
    if (minimized) {
      await currentWindow.unminimize();
    }
  });
  await runSilently(async () => {
    await currentWindow.show();
  });
  await runSilently(async () => {
    await currentWindow.setFocus();
  });
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
      const state = String((event as { state?: unknown })?.state ?? "Pressed").toLowerCase();
      if (state !== "pressed") return;
      void (async () => {
        await runSilently(focusMainWindow);
        if (!onPressed) return;
        await runSilently(async () => {
          await onPressed();
        });
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
    postAttachment: (id: string, data: Uint8Array, type: string) => {
      try {
        localStorage.setItem(`att:${id}`, bytesToBase64(data));
        localStorage.setItem(`att-type:${id}`, type);
        return { id, ok: true };
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    getAttachment: (id: string) => {
      const base64 = localStorage.getItem(`att:${id}`);
      if (!base64) return null;
      try {
        return base64ToBytes(base64);
      } catch {
        return null;
      }
    },
    getAttachmentType: (id: string) => {
      return localStorage.getItem(`att-type:${id}`);
    },
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
