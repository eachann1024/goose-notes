import type { HostDoc, HostRuntime, HostPutResult, HostRemoveResult } from "./types";

const isUToolsEnv = () =>
  typeof window !== "undefined" && typeof window.utools !== "undefined";

const getUTools = () => (isUToolsEnv() ? (window as any).utools : null);

export const hostRuntime: HostRuntime = {
  kind: "utools",
  get isUTools() {
    return isUToolsEnv();
  },
  supportsSublist: false,
  supportsWakeHotkey: false,
  ensureGooseFs: async () => {},
  db: {
    put: <T>(id: string, data: T, rev?: string): HostPutResult => {
      const utools = getUTools();
      if (!utools) {
        return { id, ok: false, error: "uTools 环境不可用" };
      }
      try {
        return utools.db.put({
          _id: id,
          _rev: rev,
          data,
        });
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    get: <T>(id: string): HostDoc<T> | null => {
      const utools = getUTools();
      if (!utools) return null;
      try {
        return utools.db.get(id);
      } catch {
        return null;
      }
    },
    remove: (id: string): HostRemoveResult => {
      const utools = getUTools();
      if (!utools) {
        return { id, ok: false, error: "uTools 环境不可用" };
      }
      try {
        return utools.db.remove(id);
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    allDocs: <T>(prefix = ""): Array<HostDoc<T>> => {
      const utools = getUTools();
      if (!utools) return [];
      try {
        return utools.db.allDocs(prefix);
      } catch {
        return [];
      }
    },
    postAttachment: (id: string, data: Uint8Array, type: string) => {
      const utools = getUTools();
      if (!utools) {
        return { id, ok: false, error: "uTools 环境不可用" };
      }
      try {
        return utools.db.postAttachment(id, data, type);
      } catch (error) {
        return { id, ok: false, error };
      }
    },
    getAttachment: (id: string) => {
      const utools = getUTools();
      if (!utools) return null;
      try {
        return utools.db.getAttachment(id);
      } catch {
        return null;
      }
    },
    getAttachmentType: (id: string) => {
      const utools = getUTools();
      if (!utools) return null;
      try {
        return utools.db.getAttachmentType(id);
      } catch {
        return null;
      }
    },
  },
  getUser: () => {
    const utools = getUTools();
    if (!utools) return null;
    return utools.getUser();
  },
  copyToClipboard: (text: string) => {
    const utools = getUTools();
    if (!utools) return;
    utools.copyText(text);
  },
  showNotification: (body: string) => {
    const utools = getUTools();
    if (!utools) return;
    utools.showNotification(body);
  },
  openUrl: (url: string, useInternalBrowser = true) => {
    const utools = getUTools();
    if (!utools) return;
    if (useInternalBrowser && typeof utools?.ubrowser?.goto === "function") {
      utools.ubrowser.goto(url).run();
      return;
    }
    utools?.shellOpenExternal?.(url);
  },
  openPath: async (targetPath: string) => {
    const utools = getUTools();
    if (!utools || typeof utools?.shellOpenPath !== "function") {
      return false;
    }
    try {
      const result = await Promise.resolve(utools.shellOpenPath(targetPath));
      if (typeof result === "string") {
        return result.length === 0;
      }
      return result !== false;
    } catch {
      return false;
    }
  },
  setSublistFn: (callback) => {
    const utools = getUTools();
    if (!utools) return;
    if (typeof utools?.setSublistFn === "function") {
      utools.setSublistFn(callback);
    }
  },
  setExpendHeight: (height: number) => {
    const utools = getUTools();
    if (!utools) return false;
    if (typeof utools?.setExpendHeight === "function") {
      return utools.setExpendHeight(height);
    }
    return false;
  },
  redirect: (label, payload) => {
    const utools = getUTools();
    if (!utools) return false;
    if (typeof utools?.redirect === "function") {
      return utools.redirect(label, payload);
    }
    return false;
  },
  registerWakeHotkey: async () => ({
    ok: false,
    error: "uTools 版本不支持全局唤醒快捷键。",
  }),
  unregisterWakeHotkey: async () => {},
  registerSearchHotkey: async () => ({
    ok: false,
    error: "uTools 版本不支持全局搜索快捷键。",
  }),
  unregisterSearchHotkey: async () => {},
};
