export interface UserInfo {
  avatar?: string;
  nickname: string;
  type: string;
}

export interface SublistItem {
  title: string;
  description: string;
  icon: string;
  url: string;
}

export interface HostDoc<T> {
  _id: string;
  _rev?: string;
  data: T;
}

export interface HostPutResult {
  id: string;
  ok: boolean;
  rev?: string;
  error?: unknown;
}

export interface HostRemoveResult {
  id: string;
  ok: boolean;
  error?: unknown;
}

export interface HostRuntime {
  kind: "utools" | "tauri" | "web";
  isUTools: boolean;
  isTauri: boolean;
  supportsSublist: boolean;
  supportsWakeHotkey: boolean;
  ensureGooseFs?: () => Promise<void>;
  db: {
    put: <T>(id: string, data: T, rev?: string) => HostPutResult;
    get: <T>(id: string) => HostDoc<T> | null;
    remove: (id: string) => HostRemoveResult;
    allDocs: <T>(prefix?: string) => Array<HostDoc<T>>;
  };
  getUser: () => UserInfo | null;
  copyToClipboard: (text: string) => void | Promise<void>;
  showNotification: (body: string) => void;
  openUrl: (url: string, useInternalBrowser?: boolean) => void | Promise<void>;
  setSublistFn: (callback: ((keyword: string) => SublistItem[]) | null) => void;
  setExpendHeight: (height: number) => boolean;
  redirect: (label: string | [string, string], payload?: unknown) => boolean;
  registerWakeHotkey: (shortcut: string) => Promise<{ ok: boolean; error?: string }>;
  unregisterWakeHotkey: (shortcut: string) => Promise<void>;
  registerSearchHotkey: (shortcut: string) => Promise<{ ok: boolean; error?: string }>;
  unregisterSearchHotkey: (shortcut: string) => Promise<void>;
}
