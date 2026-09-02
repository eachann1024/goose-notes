import { contextBridge, ipcRenderer } from "electron";

type FsChange = { path: string; type: string };

const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args);

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
  hideQuicknote: () => invoke("desktop:hideQuicknote") as Promise<void>,
  registerHotkeys: (k: { wake: string; quicknote: string; search: string }) =>
    invoke("desktop:registerHotkeys", k) as Promise<{
      wakeOk: boolean;
      quicknoteOk: boolean;
      searchOk: boolean;
    }>,
  onOpenSearch: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("desktop:open-search", listener);
    return () => {
      ipcRenderer.removeListener("desktop:open-search", listener);
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
};

contextBridge.exposeInMainWorld("gooseDesktop", gooseDesktop);
