import type { HostDoc, HostRuntime, HostPutResult, HostRemoveResult } from "./types";

const readDoc = <T>(id: string): HostDoc<T> | null => {
  const item = localStorage.getItem(id);
  if (!item) return null;

  try {
    return JSON.parse(item) as HostDoc<T>;
  } catch {
    return null;
  }
};

const writeDoc = <T>(id: string, data: T, rev?: string): HostPutResult => {
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

export const hostRuntime: HostRuntime = {
  kind: "web",
  isUTools: false,
  isTauri: false,
  supportsSublist: false,
  supportsWakeHotkey: false,
  ensureGooseFs: async () => {
    if (typeof window === "undefined" || window.gooseFs) return;
    const { browserGooseFs } = await import("../browser-fs");
    await browserGooseFs.restoreLastDirectory?.();
    window.gooseFs = browserGooseFs;
  },
  db: {
    put: writeDoc,
    get: readDoc,
    remove: removeDoc,
    allDocs,
  },
  getUser: () => ({
    nickname: "Local User",
    avatar: undefined,
    type: "web",
  }),
  copyToClipboard: (text: string) => {
    void navigator.clipboard.writeText(text);
  },
  showNotification: (body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("鹅的笔记", { body });
      return;
    }
    console.log("Notification:", body);
  },
  openUrl: (url: string) => {
    window.open(url, "_blank");
  },
  setSublistFn: () => {},
  setExpendHeight: () => false,
  redirect: () => false,
  registerWakeHotkey: async () => ({
    ok: false,
    error: "Web 环境不支持全局唤醒快捷键。",
  }),
  unregisterWakeHotkey: async () => {},
  registerSearchHotkey: async () => ({
    ok: false,
    error: "Web 环境不支持全局搜索快捷键。",
  }),
  unregisterSearchHotkey: async () => {},
};
