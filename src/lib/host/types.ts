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

/** 全局热键注册结果；state 供设置页区分 占用/无效/其它错误。 */
export interface HostHotkeyRegisterResult {
  ok: boolean;
  error?: string;
  state?: "occupied" | "invalid" | "error";
}

export interface HostRuntime {
  kind: "utools" | "electron";
  isUTools: boolean;
  supportsSublist: boolean;
  supportsWakeHotkey: boolean;
  ensureGooseFs?: () => Promise<void>;
  dbStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  db: {
    put: <T>(id: string, data: T, rev?: string) => HostPutResult;
    get: <T>(id: string) => HostDoc<T> | null;
    remove: (id: string) => HostRemoveResult;
    allDocs: <T>(prefix?: string) => Array<HostDoc<T>>;
    // 附件三方法允许异步：uTools 同步返回，Electron 走磁盘返回 Promise。
    postAttachment: (
      id: string,
      data: Uint8Array,
      type: string,
    ) => HostPutResult | Promise<HostPutResult>;
    getAttachment: (id: string) => Uint8Array | null | Promise<Uint8Array | null>;
    getAttachmentType: (id: string) => string | null | Promise<string | null>;
  };
  getUser: () => UserInfo | null;
  copyToClipboard: (text: string) => void | Promise<void>;
  showNotification: (body: string) => void;
  openUrl: (url: string, useInternalBrowser?: boolean) => void | Promise<void>;
  openPath: (targetPath: string) => boolean | Promise<boolean>;
  setSublistFn: (callback: ((keyword: string) => SublistItem[]) | null) => void;
  setExpendHeight: (height: number) => boolean;
  redirect: (label: string | [string, string], payload?: unknown) => boolean;
  registerWakeHotkey: (shortcut: string) => Promise<HostHotkeyRegisterResult>;
  unregisterWakeHotkey: (shortcut: string) => Promise<void>;
  registerSearchHotkey: (shortcut: string) => Promise<HostHotkeyRegisterResult>;
  unregisterSearchHotkey: (shortcut: string) => Promise<void>;
  registerQuicknoteHotkey: (shortcut: string) => Promise<HostHotkeyRegisterResult>;
  unregisterQuicknoteHotkey: (shortcut: string) => Promise<void>;
}
