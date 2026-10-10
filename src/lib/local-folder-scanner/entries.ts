import type { Page } from "@/types";
import type { LocalMdFileStat } from "@/lib/local-md-snapshot";

const IGNORED_FOLDERS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".vscode",
  ".idea",
  "target",
  "__pycache__",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
]);

const TRANSIENT_ENTRY_SUFFIXES = [
  ".swp",
  ".swx",
  ".tmp",
  ".crswap",
  ".part",
] as const;

function isTransientOsEntry(name: string): boolean {
  if (name.startsWith("~$")) return true;
  const lower = name.toLowerCase();
  if (lower === "thumbs.db" || lower === "desktop.ini") return true;
  return TRANSIENT_ENTRY_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export interface LocalFolderScannerOptions {
  notebookId: string;
  basePath: string;
  gooseFs: GooseFs;
  hiddenFolders?: string[];
}

export interface LocalFolderEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
}

export const SCAN_CPU_SLICE_MS = 8;

/**
 * Markdown 解析发生在渲染线程。批量扫描时定期让出一帧，避免旧版 Electron
 * Chromium 因连续长任务把窗口判定为无响应。Node 单测环境回落到 setTimeout。
 */
export function yieldToRenderer(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function nowForScanBudget(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function buildLocalPageId(
  notebookId: string,
  basePath: string,
  filePath: string,
): string {
  const relativePath = filePath.replace(basePath, "").replace(/^[\/\\]/, "");
  const encoded = encodeURIComponent(relativePath);
  return `local-${notebookId}-${encoded}`;
}

export function normalizeLocalFileTitle(name: string) {
  const base = name.replace(/\.(md|markdown)$/i, "").trim();
  return base || "无标题";
}
export function shouldIgnoreEntry(name: string, hiddenFoldersSet: Set<string>) {
  return (
    name.startsWith(".") ||
    isTransientOsEntry(name) ||
    IGNORED_FOLDERS.has(name) ||
    hiddenFoldersSet.has(name)
  );
}

/** 增量 watch 使用：只要相对路径任一目录段命中扫描器规则，就忽略整条路径。 */
export function shouldIgnoreLocalRelativePath(
  relativePath: string,
  hiddenFolders: readonly string[] = [],
) {
  const segments = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");
  const hiddenFoldersSet = new Set(hiddenFolders);
  return segments.some((segment) =>
    shouldIgnoreEntry(segment, hiddenFoldersSet),
  );
}

export async function readDirectory(
  gooseFs: GooseFs,
  dirPath: string,
): Promise<LocalFolderEntry[]> {
  if (gooseFs.readDirAsync) {
    return (await gooseFs.readDirAsync(dirPath)) || [];
  }
  return gooseFs.readDir(dirPath) || [];
}

export async function statMarkdownFile(
  gooseFs: GooseFs,
  filePath: string,
): Promise<LocalMdFileStat | undefined> {
  const statAsync = gooseFs.statAsync;
  if (!statAsync) return undefined;
  try {
    return (await statAsync(filePath)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function readMarkdownFile(
  gooseFs: GooseFs,
  filePath: string,
): Promise<{
  content: string | null;
  error?: string;
  stat?: LocalMdFileStat;
}> {
  const readContent = async (): Promise<{
    content: string | null;
    error?: string;
  }> => {
    if (gooseFs.readFileStatAsync) {
      const result = await gooseFs.readFileStatAsync(filePath);
      return {
        content: result.ok ? (result.content ?? "") : null,
        error: result.error || undefined,
      };
    }

    if (gooseFs.readFileStat) {
      const result = gooseFs.readFileStat(filePath);
      return {
        content: result.ok ? (result.content ?? "") : null,
        error: result.error || undefined,
      };
    }

    if (gooseFs.readFileAsync) {
      return {
        content: await gooseFs.readFileAsync(filePath),
      };
    }

    return {
      content: gooseFs.readFile(filePath),
    };
  };

  const [fileResult, stat] = await Promise.all([
    readContent(),
    statMarkdownFile(gooseFs, filePath),
  ]);
  return { ...fileResult, stat };
}

export function buildFolderPage(
  notebookId: string,
  basePath: string,
  entry: LocalFolderEntry,
  parentId?: string,
  resolvedId?: string,
): Page {
  return {
    id: resolvedId ?? buildLocalPageId(notebookId, basePath, entry.path),
    workspaceId: notebookId,
    parentId,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: entry.name }],
        },
      ],
    },
    isFolder: true,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: entry.path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0,
  };
}

export function localFileTitleFromPath(filePath: string): string {
  const name = filePath.replace(/^.*[\\/]/, "");
  return normalizeLocalFileTitle(name);
}
