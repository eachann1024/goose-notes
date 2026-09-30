/**
 * EditorPlatform —— 编辑器内核的平台适配契约（承重墙）。
 *
 * 编辑器内核**只 import 此接口类型**，永远不直接触碰 utools.* / gooseFs / 原生 API。
 * 运行时实现由各宿主注入：uTools 端注入 `platform/utools.ts`，Tauri 端注入 `platform/tauri.ts`，
 * 纯浏览器/测试用 `noopPlatform.ts` 兜底。
 *
 * 设计取舍：全部 fs API 统一为 async —— uTools 的同步桥在 Tauri/WKWebView 无对等物，
 * async 是跨端的最低公分母。
 *
 * 来源：plans/2026-06-01-Tauri迁移与编辑器抽取计划/extraction-blueprint.md §2
 */

// ── 通用结构 ───────────────────────────────
export interface FileStat {
  size?: number;
  mtime?: number;
  isFile: boolean;
  isDirectory: boolean;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
}

export interface FsWatchEvent {
  type: "create" | "modify" | "remove" | (string & {});
  path: string;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelections?: boolean;
  properties?: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

// ── fs ────────────────────────────────────
export interface EditorPlatformFs {
  isAvailable(): boolean;
  readFileAsync(path: string): Promise<string | null>;
  readFileStatAsync(path: string): Promise<FileStat | null>;
  /** 图片读取，统一 async（WKWebView/Tauri 无同步桥） */
  readFileBase64(path: string): Promise<string | null>;
  writeFileAsync(
    path: string,
    content: string,
    encoding?: "utf8" | "base64"
  ): Promise<boolean>;
  writeTempFile(relativePath: string, contentBase64: string): Promise<string | null>;
  cleanupTempFiles(prefix: string, maxAgeMs: number): Promise<void>;
  existsAsync(path: string): Promise<boolean>;
  mkdir(path: string): Promise<boolean>;
  readDirAsync(path: string): Promise<DirEntry[]>;
  deleteFile(path: string): Promise<boolean>;
  deleteDir(path: string): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<boolean>;
  /** 返回 unlisten 函数 */
  watch(path: string, cb: (e: FsWatchEvent) => void): () => void;
  revealItemInFolder(path: string): Promise<boolean>;
}

// ── shell ─────────────────────────────────
export interface EditorPlatformShell {
  openPath(targetPath: string): Promise<boolean>;
  showItemInFolder(targetPath: string): Promise<boolean>;
  /** Tauri 无内置浏览器，忽略 useInternalBrowser 走系统浏览器 */
  openUrl(url: string, useInternalBrowser?: boolean): Promise<void>;
  showNotification(body: string): void;
  getDownloadsPath(): Promise<string | null>;
}

// ── imageStorage ──────────────────────────
export interface EditorPlatformImageStorage {
  /** 返回 att:/uuid:/本地相对/data: 引用 */
  save(blob: Blob, mimeType: string): Promise<string>;
  load(ref: string): Promise<Blob | null>;
  delete(ref: string): Promise<void>;
  /** ObjectURL 缓存 */
  resolveRefToUrl(ref: string, pageLocalFilePath?: string | null): Promise<string>;
}

// ── dialog ────────────────────────────────
export interface EditorPlatformDialog {
  showSaveDialog(options?: SaveDialogOptions): Promise<string | null>;
  showOpenDialog(options?: OpenDialogOptions): Promise<string[] | null>;
  selectDirectory(): Promise<string | null>;
  restoreLastDirectory(): Promise<string | null>;
}

// ── clipboard ─────────────────────────────
export interface EditorPlatformClipboard {
  copyText(text: string): Promise<void>;
  copyImage(dataUrl: string): Promise<void>;
  readText(): Promise<string>;
}

// ── ai（吸收 AI provider 平台分支）─────────
export interface EditorPlatformAi {
  /** 平台原生 AI 是否可用（uTools: window.utools.ai；Tauri: false→走 transport 直连） */
  isNativeSupported(): boolean;
  /** 原生模型列表（uTools allAiModels；Tauri 返回 []） */
  listNativeModels(): Promise<Array<{ id: string; label: string }>>;
  /** 原生流式调用（uTools.ai）；非原生端返回 null，由 blocknoteAITransport 浏览器直连兜底 */
  runStream?(
    req: unknown,
    onChunk: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<string> | null;
  /**
   * 宿主注入的 fetch，供 AI provider 绕过 WebView 的 CORS/ATS（如 Tauri 用 plugin-http
   * 从 Rust 层发起请求）。未提供时 blocknoteAITransport 自动回退到 globalThis.fetch，
   * uTools 端因不提供此成员，行为与浏览器直连完全一致。
   */
  customFetch?: typeof fetch;
}

// ── 顶层聚合 ──────────────────────────────
export interface EditorPlatform {
  fs: EditorPlatformFs;
  shell: EditorPlatformShell;
  imageStorage: EditorPlatformImageStorage;
  dialog: EditorPlatformDialog;
  clipboard: EditorPlatformClipboard;
  ai: EditorPlatformAi;
}
