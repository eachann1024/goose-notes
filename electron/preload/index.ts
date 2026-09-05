import { contextBridge, ipcRenderer } from "electron";

type FsChange = { path: string; type: string };

type WindowTabSnapshot = {
  id: string;
  pageId: string;
  type?: string;
  pinned?: boolean;
  workspaceId?: string;
};

type WindowInitPayload = {
  takeTab?: WindowTabSnapshot;
  restoredTabs?: WindowTabSnapshot[];
};

type AcceptTabPayload = {
  tab: WindowTabSnapshot;
  contentX: number;
};

type TabDockPreviewPayload = {
  contentX: number | null;
};

type FinishTabDragResult =
  | { action: "none" }
  | { action: "tearOff"; windowId: string }
  | { action: "docked"; windowId: string };

const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args);

let pendingWindowInit: WindowInitPayload | null = null;
ipcRenderer.on("desktop:window-init", (_event, payload: WindowInitPayload) => {
  pendingWindowInit = payload;
});

const gooseDesktop = {
  selectDirectory: () => invoke("desktop:selectDirectory") as Promise<string | null>,
  showOpenDialog: (opts: {
    filters?: { name: string; extensions: string[] }[];
    multiple?: boolean;
  }) => invoke("desktop:showOpenDialog", opts) as Promise<string[] | null>,
  showSaveDialog: (opts: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => invoke("desktop:showSaveDialog", opts) as Promise<string | null>,
  fsReadText: (p: string) => invoke("desktop:fsReadText", p) as Promise<string>,
  fsWriteText: (p: string, data: string) =>
    invoke("desktop:fsWriteText", p, data) as Promise<void>,
  fsRead: (p: string) => invoke("desktop:fsRead", p) as Promise<Uint8Array>,
  fsWrite: (p: string, data: Uint8Array) =>
    invoke("desktop:fsWrite", p, data) as Promise<void>,
  fsReadDir: (p: string) =>
    invoke("desktop:fsReadDir", p) as Promise<
      { name: string; isDirectory: boolean; path: string }[]
    >,
  fsMkdir: (p: string) => invoke("desktop:fsMkdir", p) as Promise<void>,
  fsExists: (p: string) => invoke("desktop:fsExists", p) as Promise<boolean>,
  fsStat: (p: string) =>
    invoke("desktop:fsStat", p) as Promise<{
      size: number;
      isDirectory: boolean;
      mtimeMs: number;
    }>,
  fsRename: (from: string, to: string) =>
    invoke("desktop:fsRename", from, to) as Promise<void>,
  fsRemove: (p: string) => invoke("desktop:fsRemove", p) as Promise<void>,
  restoreFromTrash: (p: string) =>
    invoke("desktop:restoreFromTrash", p) as Promise<boolean>,
  fsWatch: (p: string) => invoke("desktop:fsWatch", p) as Promise<string>,
  fsUnwatch: (id: string) => invoke("desktop:fsUnwatch", id) as Promise<void>,
  onFsChange: (cb: (e: FsChange) => void) => {
    const listener = (_event: unknown, payload: FsChange) => cb(payload);
    ipcRenderer.on("desktop:fs-change", listener);
    return () => {
      ipcRenderer.removeListener("desktop:fs-change", listener);
    };
  },
  getUserDataPath: () => invoke("desktop:getUserDataPath") as Promise<string>,
  getDownloadsPath: () => invoke("desktop:getDownloadsPath") as Promise<string>,
  saveToDownloads: (filename: string, data: Uint8Array) =>
    invoke("desktop:saveToDownloads", filename, data) as Promise<string>,
  joinPath: (...parts: string[]) =>
    invoke("desktop:joinPath", parts) as Promise<string>,
  openUrl: (url: string) => invoke("desktop:openUrl", url) as Promise<void>,
  openPath: (p: string) => invoke("desktop:openPath", p) as Promise<void>,
  showItemInFolder: (p: string) =>
    invoke("desktop:showItemInFolder", p) as Promise<void>,
  listOpenApps: () =>
    invoke("desktop:listOpenApps") as Promise<{ name: string; path: string }[]>,
  openWithApp: (app: string, p: string) =>
    invoke("desktop:openWithApp", app, p) as Promise<void>,
  openTerminalAtPath: (p: string) =>
    invoke("desktop:openTerminalAtPath", p) as Promise<void>,
  writeText: (t: string) => invoke("desktop:writeText", t) as Promise<void>,
  writeImage: (dataUrl: string) =>
    invoke("desktop:writeImage", dataUrl) as Promise<void>,
  readText: () => invoke("desktop:readText") as Promise<string>,
  printHtmlToPdf: (html: string) =>
    invoke("desktop:printHtmlToPdf", html) as Promise<string | null>,
  netFetch: (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) =>
    invoke("desktop:netFetch", url, init) as Promise<{
      status: number;
      headers: Record<string, string>;
      body: string;
    }>,
  setTitle: (t: string) => invoke("desktop:setTitle", t) as Promise<void>,
  getAlwaysOnTop: () => invoke("desktop:getAlwaysOnTop") as Promise<boolean>,
  setAlwaysOnTop: (on: boolean) =>
    invoke("desktop:setAlwaysOnTop", on) as Promise<boolean>,
  syncTitleBarHeight: (height: number) =>
    invoke("desktop:syncTitleBarHeight", height) as Promise<void>,
  toggleMainWindow: () => invoke("desktop:toggleMainWindow") as Promise<void>,
  toggleQuicknote: () => invoke("desktop:toggleQuicknote") as Promise<void>,
  closeQuicknote: () => invoke("desktop:closeQuicknote") as Promise<void>,
  registerHotkeys: (k: { wake: string; quicknote: string; search: string }) =>
    invoke("desktop:registerHotkeys", k) as Promise<{
      wakeOk: boolean;
      quicknoteOk: boolean;
      searchOk: boolean;
    }>,
  pauseHotkeys: () => invoke("desktop:pauseHotkeys") as Promise<void>,
  resumeHotkeys: () =>
    invoke("desktop:resumeHotkeys") as Promise<{
      wakeOk: boolean;
      quicknoteOk: boolean;
      searchOk: boolean;
    }>,
  getAccessibilityStatus: () =>
    invoke("desktop:getAccessibilityStatus") as Promise<{
      platform: string;
      trusted: boolean;
    }>,
  requestAccessibility: () =>
    invoke("desktop:requestAccessibility") as Promise<boolean>,
  onOpenSearch: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("desktop:open-search", listener);
    return () => {
      ipcRenderer.removeListener("desktop:open-search", listener);
    };
  },
  onCloseActiveTab: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("desktop:close-active-tab", listener);
    return () => {
      ipcRenderer.removeListener("desktop:close-active-tab", listener);
    };
  },
  takePendingOpenMarkdownFiles: () =>
    invoke("desktop:takePendingOpenMarkdownFiles") as Promise<string[]>,
  onOpenMarkdownFiles: (cb: (files: string[]) => void) => {
    const listener = (_event: unknown, files: string[]) => cb(files);
    ipcRenderer.on("desktop:open-markdown-files", listener);
    return () => {
      ipcRenderer.removeListener("desktop:open-markdown-files", listener);
    };
  },
  notify: (n: { title: string; body: string }) =>
    invoke("desktop:notify", n) as Promise<void>,
  getWindowContext: () =>
    invoke("desktop:getWindowContext") as Promise<{
      windowId: string;
      kind: "workspace" | "quicknote";
    }>,
  createWindow: (opts: {
    mode: "blank" | "currentTab";
    tab?: WindowTabSnapshot;
    bounds?: { x: number; y: number; width: number; height: number };
  }) => invoke("desktop:createWindow", opts) as Promise<{ windowId: string }>,
  closeWindow: (windowId?: string) =>
    invoke("desktop:closeWindow", windowId) as Promise<void>,
  finishTabDrag: (opts: {
    tab: WindowTabSnapshot;
    cursor: { x: number; y: number };
    sourceTabCount: number;
    grabOffsetX?: number;
  }) => invoke("desktop:finishTabDrag", opts) as Promise<FinishTabDragResult>,
  tabDragMove: (cursor: { x: number; y: number }) =>
    invoke("desktop:tabDragMove", cursor) as Promise<void>,
  tabDragCancel: () => invoke("desktop:tabDragCancel") as Promise<void>,
  onAcceptTab: (cb: (payload: AcceptTabPayload) => void) => {
    const listener = (_event: unknown, payload: AcceptTabPayload) => cb(payload);
    ipcRenderer.on("desktop:accept-tab", listener);
    return () => {
      ipcRenderer.removeListener("desktop:accept-tab", listener);
    };
  },
  onTabDockPreview: (cb: (payload: TabDockPreviewPayload) => void) => {
    const listener = (_event: unknown, payload: TabDockPreviewPayload) =>
      cb(payload);
    ipcRenderer.on("desktop:tab-dock-preview", listener);
    return () => {
      ipcRenderer.removeListener("desktop:tab-dock-preview", listener);
    };
  },
  onWindowInit: (cb: (payload: WindowInitPayload) => void) => {
    if (pendingWindowInit) {
      const payload = pendingWindowInit;
      queueMicrotask(() => cb(payload));
    }
    const listener = (_event: unknown, payload: WindowInitPayload) => {
      pendingWindowInit = payload;
      cb(payload);
    };
    ipcRenderer.on("desktop:window-init", listener);
    return () => {
      ipcRenderer.removeListener("desktop:window-init", listener);
    };
  },
};

contextBridge.exposeInMainWorld("gooseDesktop", gooseDesktop);
