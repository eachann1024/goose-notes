import type { HostDoc, HostRuntime, HostPutResult, HostRemoveResult } from "./types";

const isUToolsEnv = () =>
  typeof window !== "undefined" && typeof window.utools !== "undefined";

const readFallbackDoc = <T>(id: string): HostDoc<T> | null => {
  const item = localStorage.getItem(id);
  if (!item) return null;
  try {
    return JSON.parse(item) as HostDoc<T>;
  } catch {
    return null;
  }
};

const putFallbackDoc = <T>(id: string, data: T, rev?: string): HostPutResult => {
  try {
    const doc = { _id: id, _rev: rev || Date.now().toString(), data };
    localStorage.setItem(id, JSON.stringify(doc));
    return { id, ok: true, rev: doc._rev };
  } catch (error) {
    return { id, ok: false, error };
  }
};

const removeFallbackDoc = (id: string): HostRemoveResult => {
  localStorage.removeItem(id);
  return { id, ok: true };
};

const allFallbackDocs = <T>(prefix = ""): Array<HostDoc<T>> => {
  const docs: Array<HostDoc<T>> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const doc = readFallbackDoc<T>(key);
    if (doc) docs.push(doc);
  }
  return docs;
};

export const hostRuntime: HostRuntime = {
  kind: "utools",
  get isUTools() {
    return isUToolsEnv();
  },
  isTauri: false,
  get supportsSublist() {
    if (!isUToolsEnv()) return false;
    const utools = (window as any).utools;
    return typeof utools?.setSublistFn === "function";
  },
  supportsWakeHotkey: false,
  db: {
    put: <T>(id: string, data: T, rev?: string) => {
      if (!isUToolsEnv()) return putFallbackDoc(id, data, rev);
      try {
        return (window as any).utools.db.put({
          _id: id,
          _rev: rev,
          data,
        });
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    get: <T>(id: string) => {
      if (!isUToolsEnv()) return readFallbackDoc<T>(id);
      try {
        return (window as any).utools.db.get(id);
      } catch {
        return null;
      }
    },
    remove: (id: string) => {
      if (!isUToolsEnv()) return removeFallbackDoc(id);
      try {
        return (window as any).utools.db.remove(id);
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    allDocs: <T>(prefix = "") => {
      if (!isUToolsEnv()) return allFallbackDocs<T>(prefix);
      try {
        return (window as any).utools.db.allDocs(prefix);
      } catch {
        return [];
      }
    },
    postAttachment: (id: string, data: Uint8Array, type: string) => {
      if (!isUToolsEnv()) {
        // Web fallback: 存到 localStorage（base64 编码）
        try {
          const base64 = btoa(String.fromCharCode(...data));
          localStorage.setItem(`att:${id}`, base64);
          localStorage.setItem(`att-type:${id}`, type);
          return { id, ok: true };
        } catch (error) {
          return { id, ok: false, error };
        }
      }
      try {
        return (window as any).utools.db.postAttachment(id, data, type);
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    getAttachment: (id: string) => {
      if (!isUToolsEnv()) {
        const base64 = localStorage.getItem(`att:${id}`);
        if (!base64) return null;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      try {
        return (window as any).utools.db.getAttachment(id);
      } catch {
        return null;
      }
    },
    getAttachmentType: (id: string) => {
      if (!isUToolsEnv()) {
        return localStorage.getItem(`att-type:${id}`);
      }
      try {
        return (window as any).utools.db.getAttachmentType(id);
      } catch {
        return null;
      }
    },
  },
  getUser: () => {
    if (!isUToolsEnv()) {
      return {
        nickname: "Local User",
        avatar: undefined,
        type: "web",
      };
    }
    return (window as any).utools.getUser();
  },
  copyToClipboard: (text: string) => {
    if (isUToolsEnv()) {
      (window as any).utools.copyText(text);
      return;
    }
    void navigator.clipboard.writeText(text);
  },
  showNotification: (body: string) => {
    if (isUToolsEnv()) {
      (window as any).utools.showNotification(body);
      return;
    }
    console.log("Notification:", body);
  },
  openUrl: (url: string, useInternalBrowser = true) => {
    if (isUToolsEnv()) {
      const utools = (window as any).utools;
      if (useInternalBrowser && typeof utools?.ubrowser?.goto === "function") {
        utools.ubrowser.goto(url).run();
        return;
      }
      utools?.shellOpenExternal?.(url);
      return;
    }
    window.open(url, "_blank");
  },
  setSublistFn: (callback) => {
    if (!isUToolsEnv()) return;
    const utools = (window as any).utools;
    if (typeof utools?.setSublistFn === "function") {
      utools.setSublistFn(callback);
    }
  },
  setExpendHeight: (height: number) => {
    if (!isUToolsEnv()) return false;
    const utools = (window as any).utools;
    if (typeof utools?.setExpendHeight === "function") {
      return utools.setExpendHeight(height);
    }
    return false;
  },
  redirect: (label, payload) => {
    if (!isUToolsEnv()) return false;
    const utools = (window as any).utools;
    if (typeof utools?.redirect === "function") {
      return utools.redirect(label, payload);
    }
    return false;
  },
  registerWakeHotkey: async () => ({
    ok: false,
    error: "uTools 环境不支持 Tauri 全局唤醒快捷键。",
  }),
  unregisterWakeHotkey: async () => {},
  registerSearchHotkey: async () => ({
    ok: false,
    error: "uTools 环境不支持 Tauri 全局搜索快捷键。",
  }),
  unregisterSearchHotkey: async () => {},
};
