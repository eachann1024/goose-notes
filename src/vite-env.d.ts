/// <reference types="vite/client" />
export {}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_TINYFISH_API_KEY_A?: string;
  readonly VITE_TINYFISH_API_KEY_B?: string;
}
declare global {
  const __HOST_TARGET__: "electron";

  /**
   * 速记小窗（plugin B / dist-quicknote）精简构建标志。
   * GOOSE_BUILD_TARGET=quicknote 的构建里为 true（见 vite.config.ts define），
   * 编辑器据此把 math/mermaid 退化为纯代码块、隐藏代码格式化按钮，
   * 配合 alias 把 katex/mermaid/prettier 等重型依赖排除出小窗包。
   * 主应用（plugin A）构建恒为 false，行为完全不变。
   */
  const __GOOSE_LITE__: boolean;
  const __GOOSE_EDITOR_COMPACT__: boolean;

  /**
   * 编辑器 AI 能力编译开关。主笔记本为 true；速记和原生 macOS 编辑器产物为 false。
   * 与 __GOOSE_LITE__ 分离，确保原生编辑器保留数学、Mermaid、视频和代码格式化，
   * 同时不会把 AI SDK 或 AI 菜单带入生产包。
   */
  const __GOOSE_EDITOR_AI__: boolean;

  interface GooseFs {
    readDir: (dir: string) => any[];
    readDirAsync?: (dir: string) => Promise<any[]>;
    readFile: (path: string) => string | null;
    readFileAsync?: (path: string) => Promise<string | null>;
    readFileBase64?: (path: string) => string | null;
    readFileBase64Async?: (path: string) => Promise<string | null>;
    readFileStat?: (
      path: string,
    ) => { ok: boolean; error?: string | null; content?: string | null };
    readFileStatAsync?: (
      path: string,
    ) => Promise<{ ok: boolean; error?: string | null; content?: string | null }>;
    writeFile: (path: string, content: string, encoding?: string) => boolean;
    writeFileAsync?: (path: string, content: string, encoding?: string) => Promise<boolean>;
    exists: (path: string) => boolean;
    existsAsync?: (path: string) => Promise<boolean>;
    /** 仅 mtimeMs + size，不含 atime。供本地文件夹 watch 指纹快路径使用。 */
    statAsync?: (path: string) => Promise<{ mtimeMs: number; size: number } | null>;
    realpathAsync?: (path: string) => Promise<string | null>;
    watch: (dir: string, cb: any) => any;
    unwatch: (dir: string) => void;
    mkdir: (dir: string) => boolean | Promise<boolean>;
    deleteFile: (path: string) => boolean | Promise<boolean>;
    deleteDir: (path: string) => boolean | Promise<boolean>;
    rename: (oldPath: string, newPath: string) => boolean | Promise<boolean>;
    writeTempFile?: (relativePath: string, contentBase64: string) => Promise<string | null>;
    cleanupTempFiles?: (prefix: string, maxAgeMs: number) => Promise<void>;
    /** 隐藏窗 printToPDF，返回 PDF base64；不可用或失败时为 null。 */
    printHtmlToPdf?: (html: string) => Promise<string | null>;
    selectDirectory?: () => Promise<string | null>;
    restoreLastDirectory?: () => Promise<string | null>;
    restoreFromTrash?: (path: string) => Promise<boolean>;
    revealItemInFolder?: (path: string) => boolean | Promise<boolean>;
    listAvailableOpenApps?: <T extends { appName: string }>(candidates: T[]) => Promise<T[]>;
    openWithApp?: (path: string, app: string) => Promise<boolean>;
    openTerminalAtPath?: (path: string, terminal?: string) => Promise<boolean>;
  }


  interface GooseDesktop {
    selectDirectory: () => Promise<string | null>
    showOpenDialog: (opts: { filters?: {name:string;extensions:string[]}[]; multiple?: boolean }) => Promise<string[] | null>
    showSaveDialog: (opts: { defaultPath?: string; filters?: {name:string;extensions:string[]}[] }) => Promise<string | null>
    fsReadText: (p: string) => Promise<string>
    fsWriteText: (p: string, data: string) => Promise<void>
    fsRead: (p: string) => Promise<Uint8Array>
    fsWrite: (p: string, data: Uint8Array) => Promise<void>
    fsReadDir: (p: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>
    fsMkdir: (p: string) => Promise<void>
    fsExists: (p: string) => Promise<boolean>
    fsRealpath: (p: string) => Promise<string>
    fsStat: (p: string) => Promise<{ size: number; isDirectory: boolean; mtimeMs: number }>
    fsRename: (from: string, to: string) => Promise<void>
    fsRemove: (p: string) => Promise<void>
    restoreFromTrash: (p: string) => Promise<boolean>
    fsWatch: (p: string) => Promise<string>
    fsUnwatch: (id: string) => Promise<void>
    onFsChange: (cb: (e: { path: string; type: string }) => void) => () => void
    getUserDataPath: () => Promise<string>
    getDownloadsPath: () => Promise<string>
    saveToDownloads: (filename: string, data: Uint8Array) => Promise<string>
    joinPath: (...parts: string[]) => Promise<string>
    openUrl: (url: string) => Promise<void>
    openPath: (p: string) => Promise<void>
    showItemInFolder: (p: string) => Promise<void>
    listOpenApps: () => Promise<{ name: string; path: string }[]>
    openWithApp: (app: string, p: string) => Promise<void>
    openTerminalAtPath: (p: string, terminal?: string) => Promise<void>
    getAppVersion: () => Promise<string>
    checkForUpdate: () => Promise<
      | {
          status: "up-to-date"
          currentVersion: string
          latestVersion: string
          releaseUrl: string
        }
      | {
          status: "available"
          currentVersion: string
          latestVersion: string
          assetName: string
          downloadUrl: string
          releaseUrl: string
        }
      | {
          status: "unavailable"
          currentVersion: string
          reason: string
          releaseUrl: string
        }
    >
    downloadUpdate: (downloadUrl: string, filename: string) => Promise<{ path: string }>
    writeText: (t: string) => Promise<void>
    writeImage: (dataUrl: string) => Promise<void>
    readText: () => Promise<string>
    printHtmlToPdf: (html: string) => Promise<string | null>
    netFetch: (url: string, init?: { method?: string; headers?: Record<string,string>; body?: string }) => Promise<{ status: number; headers: Record<string,string>; body: string }>
    setTitle: (t: string) => Promise<void>
    getAlwaysOnTop: () => Promise<boolean>
    setAlwaysOnTop: (on: boolean) => Promise<boolean>
    syncTitleBarHeight: (height: number) => Promise<void>
    toggleMainWindow: () => Promise<void>
    showMainWindow: (action?: "none" | "search" | "settings" | "ai-panel" | "new-note") => Promise<void>
    toggleQuicknote: () => Promise<void>
    closeQuicknote: () => Promise<void>
    registerHotkeys: (k: { wake: string; quicknote: string; search: string }) => Promise<{ wakeOk: boolean; quicknoteOk: boolean; searchOk: boolean }>
    pauseHotkeys: () => Promise<void>
    resumeHotkeys: () => Promise<{ wakeOk: boolean; quicknoteOk: boolean; searchOk: boolean }>
    getAccessibilityStatus: () => Promise<{ platform: string; trusted: boolean }>
    requestAccessibility: () => Promise<boolean>
    onOpenSearch: (cb: () => void) => () => void
    onWorkspaceAction: (cb: (action: "search" | "settings" | "ai-panel" | "new-note") => void) => () => void
    onCloseActiveTab: (cb: () => void) => () => void
    takePendingOpenMarkdownFiles: () => Promise<string[]>
    onOpenMarkdownFiles: (cb: (files: string[]) => void) => () => void
    notify: (n: { title: string; body: string }) => Promise<void>
    getWindowContext: () => Promise<{ windowId: string; kind: "workspace" | "quicknote" }>
    createWindow: (opts: {
      mode: "blank" | "currentTab"
      tab?: { id: string; pageId: string; type?: string; pinned?: boolean; workspaceId?: string }
      bounds?: { x: number; y: number; width: number; height: number }
    }) => Promise<{ windowId: string }>
    closeWindow: (windowId?: string) => Promise<void>
    minimizeWindow: () => Promise<void>
    toggleMaximizeWindow: () => Promise<boolean>
    isWindowMaximized: () => Promise<boolean>
    finishTabDrag: (opts: {
      tab: { id: string; pageId: string; type?: string; pinned?: boolean; workspaceId?: string }
      cursor: { x: number; y: number }
      sourceTabCount: number
      grabOffsetX?: number
    }) => Promise<
      | { action: "none" }
      | { action: "tearOff"; windowId: string }
      | { action: "docked"; windowId: string }
    >
    tabDragMove: (cursor: { x: number; y: number }) => Promise<void>
    tabDragCancel: () => Promise<void>
    startWindowDrag: () => Promise<void>
    endWindowDrag: () => Promise<void>
    onAcceptTab: (
      cb: (payload: {
        tab: { id: string; pageId: string; type?: string; pinned?: boolean; workspaceId?: string }
        contentX: number
      }) => void,
    ) => () => void
    onTabDockPreview: (cb: (payload: { contentX: number | null }) => void) => () => void
    onWindowInit: (cb: (payload: {
      takeTab?: { id: string; pageId: string; type?: string; pinned?: boolean; workspaceId?: string }
      restoredTabs?: Array<{ id: string; pageId: string; type?: string; pinned?: boolean; workspaceId?: string }>
    }) => void) => () => void
  }

  interface Window {
    gooseAiContext?: {
      readGlobalPrompt: () => string | null;
      listLocalSkills: () => Array<{ path: string; content: string }>;
    };
    gooseFs?: GooseFs;
    gooseDesktop?: GooseDesktop;
    gooseWeb?: {
      fetchText: (url: string) => Promise<{
        ok: true;
        url: string;
        status: number;
        contentType: string;
        text: string;
      }>;
    };
    gooseErrorReporting?: {
      readConfig: () => unknown;
      sendEnvelope: (
        url: string,
        body: string | Uint8Array,
        headers?: Record<string, string>,
      ) => Promise<{ statusCode?: number }>;
    };
    __gooseNoteReportError?: (
      error: unknown,
      extra?: Record<string, unknown>,
    ) => void;
    /** B 插件（独立速记）preload 注入的标志，子窗 web 侧据此区分 redirect vs 本地落库。 */
    __GOOSE_QUICKNOTE_STANDALONE__?: boolean;
  }
}
