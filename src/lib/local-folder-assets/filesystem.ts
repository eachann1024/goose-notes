import type { JSONContent } from "@/types";
import { getLocalMdSnapshot } from "../local-md-snapshot";
import type {
  LocalFolderEntry,
  AssetMaintenanceFs,
  ScanUnreferencedLocalAssetsOptions,
} from "./types";
import {
  normalizePath,
  dirname,
  getLocalAssetKind,
  createReferenceIndex,
  collectReferencesFromJson,
  extractAssetReferencesFromMarkdown,
  type LocalAssetReferenceIndex,
} from "./references";

async function readDirectory(
  gooseFs: AssetMaintenanceFs,
  path: string,
): Promise<LocalFolderEntry[]> {
  const entries = gooseFs.readDirAsync
    ? await gooseFs.readDirAsync(path)
    : gooseFs.readDir(path);
  if (!Array.isArray(entries)) throw new Error(`无法读取目录：${path}`);
  return entries;
}

export async function pathExists(
  gooseFs: AssetMaintenanceFs,
  path: string,
): Promise<boolean> {
  if (gooseFs.existsAsync) return Boolean(await gooseFs.existsAsync(path));
  return Boolean(gooseFs.exists(path));
}

async function readTextFile(
  gooseFs: AssetMaintenanceFs,
  filePath: string,
): Promise<string | null> {
  const text = gooseFs.readFileAsync
    ? await gooseFs.readFileAsync(filePath)
    : gooseFs.readFile(filePath);
  if (typeof text !== "string")
    throw new Error(`无法读取 Markdown：${filePath}`);
  return text;
}

function isWithin(basePath: string, target: string): boolean {
  return normalizePath(target).startsWith(
    `${normalizePath(basePath).replace(/\/$/, "")}/`,
  );
}

// 包含隐藏目录以及 assets 中的 Markdown；不读取 JS/CSS 等其它文件内容。
export async function collectNotebookFiles(
  gooseFs: AssetMaintenanceFs,
  basePath: string,
) {
  const markdown: string[] = [];
  const assets: LocalFolderEntry[] = [];
  const seen = new Set<string>();
  const walk = async (directory: string) => {
    if (seen.has(directory)) throw new Error(`目录循环：${directory}`);
    seen.add(directory);
    const entries = await readDirectory(gooseFs, directory);
    for (const entry of entries) {
      if (
        !isWithin(basePath, entry.path) ||
        dirname(entry.path) !== normalizePath(directory)
      ) {
        throw new Error(`扫描路径超出笔记本：${entry.path}`);
      }
      if (entry.isDirectory) await walk(entry.path);
      if (!entry.isFile) continue;
      if (/\.(md|markdown)$/i.test(entry.name)) markdown.push(entry.path);
      if (
        getLocalAssetKind(entry.name) &&
        /(?:^|\/)assets\//i.test(relativePath(basePath, entry.path))
      ) {
        assets.push(entry);
      }
    }
  };
  await walk(normalizePath(basePath));
  return { markdown, assets };
}

export function relativePath(basePath: string, targetPath: string): string {
  const base = normalizePath(basePath).replace(/\/$/, "");
  const target = normalizePath(targetPath);
  return target.startsWith(`${base}/`) ? target.slice(base.length + 1) : target;
}

export function getFileSize(
  gooseFs: AssetMaintenanceFs,
  entry: LocalFolderEntry,
): number {
  if (typeof entry.size === "number") return entry.size;
  const base64 = gooseFs.readFileBase64?.(entry.path);
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function collectReferenceIndex(
  { basePath, pages, gooseFs }: ScanUnreferencedLocalAssetsOptions,
  diskMarkdown?: string[],
): Promise<LocalAssetReferenceIndex> {
  const normalizedBasePath = normalizePath(basePath);
  const index = createReferenceIndex();
  const seenMarkdown = new Set<string>();

  const ingestMarkdown = async (
    filePath: string,
    fallbackContent?: unknown,
  ) => {
    if (!filePath || !isWithin(normalizedBasePath, filePath)) return;
    const key = normalizePath(filePath);
    if (!seenMarkdown.has(key)) {
      seenMarkdown.add(key);
      const markdown = await readTextFile(gooseFs, filePath);
      if (typeof markdown === "string") {
        extractAssetReferencesFromMarkdown(
          markdown,
          filePath,
          normalizedBasePath,
          index,
        );
      }
    }
    if (fallbackContent !== undefined) {
      collectReferencesFromJson(
        fallbackContent,
        filePath,
        normalizedBasePath,
        index,
        new WeakSet(),
      );
    }
  };

  for (const page of pages) {
    if (page.isFolder || !page.localFilePath) continue;
    if (!isWithin(normalizedBasePath, page.localFilePath)) continue;
    collectReferencesFromJson(
      page.content as JSONContent,
      page.localFilePath,
      normalizedBasePath,
      index,
      new WeakSet(),
    );
    const snapshot = getLocalMdSnapshot(page.localFilePath);
    if (snapshot !== undefined)
      extractAssetReferencesFromMarkdown(
        snapshot,
        page.localFilePath,
        normalizedBasePath,
        index,
      );
  }

  for (const filePath of diskMarkdown ??
    (await collectNotebookFiles(gooseFs, normalizedBasePath)).markdown) {
    await ingestMarkdown(filePath);
  }

  return index;
}
