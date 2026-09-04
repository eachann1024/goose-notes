import type { JSONContent, Page } from "@/types";
import { isInternalAssetRef } from "@/lib/internalAssetRef";
import {
  isLocalFilePath,
  resolveToAbsolute,
} from "@/lib/imageStorage/strategies/file-system";
import { shouldIgnoreLocalRelativePath } from "@/lib/local-folder-scanner";
import { getLocalMdSnapshot } from "@/lib/local-md-snapshot";

interface LocalFolderEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
  size?: number;
}

export interface UnreferencedLocalAsset {
  path: string;
  relativePath: string;
  name: string;
  size: number;
}

export interface RestoreMissingLocalAssetsResult {
  restored: string[];
  missing: string[];
}

interface ScanUnreferencedLocalAssetsOptions {
  basePath: string;
  pages: Pick<Page, "content" | "localFilePath" | "isFolder">[];
  gooseFs: GooseFs;
}

interface LocalAssetReferenceIndex {
  paths: Set<string>;
  pathKeys: Set<string>;
  names: Set<string>;
}

const MARKDOWN_LINK_RE =
  /!?\[[^\]]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const HTML_SRC_RE =
  /\b(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
const WIKI_EMBED_RE = /!?\[\[([^\]|#\n]+)(?:[|#][^\]]*)?\]\]/g;
const BARE_ASSETS_RE = /(?:(?:\.\.?\/)*)assets\/[^\s)\]"'<>]+/gi;
const MEDIA_FILE_RE =
  /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?|mp4|m4v|webm|mov|mkv|mp3|wav|ogg|m4a|pdf|zip|html?)$/i;

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const prefix =
    normalized.match(/^[A-Za-z]:\//)?.[0] ??
    (normalized.startsWith("/") ? "/" : "");
  const segments: string[] = [];
  for (const segment of normalized.slice(prefix.length).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length) segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `${prefix}${segments.join("/")}` || "/";
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? normalized.slice(0, 1) : normalized.slice(0, index);
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function pathKey(value: string): string {
  return normalizePath(value).toLowerCase();
}

function isAssetPath(value: string): boolean {
  return /(?:^|\/)assets(?:\/|$)/i.test(normalizePath(value));
}

function looksLikeLocalMedia(value: string): boolean {
  return isAssetPath(value) || MEDIA_FILE_RE.test(value);
}

export function cleanAssetDestination(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  if (
    (value.startsWith("<") && value.endsWith(">")) ||
    (value.startsWith("<") && value.includes(">"))
  ) {
    value = value.replace(/^</, "").replace(/>$/, "").trim();
  }
  const titled = value.match(/^(\S+)\s+["'(]/);
  if (titled) value = titled[1];
  if (/^file:/i.test(value)) {
    try {
      const fileUrl = new URL(value);
      value = decodeURIComponent(fileUrl.pathname);
      if (/^\/[A-Za-z]:\//.test(value)) value = value.slice(1);
    } catch {
      // keep original
    }
  }
  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0) value = value.slice(0, hashIndex);
  const queryIndex = value.indexOf("?");
  if (queryIndex >= 0) value = value.slice(0, queryIndex);
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep original
  }
  return value.trim();
}

function shouldSkipRemoteOrInternal(value: string): boolean {
  return (
    !value ||
    /^(?:https?:|data:|blob:|#|mailto:)/i.test(value) ||
    isInternalAssetRef(value)
  );
}

function addReference(
  value: string,
  pagePath: string,
  basePath: string,
  index: LocalAssetReferenceIndex,
) {
  const cleaned = cleanAssetDestination(value);
  if (shouldSkipRemoteOrInternal(cleaned)) return;
  if (!isLocalFilePath(cleaned) && !looksLikeLocalMedia(cleaned)) return;

  const name = basename(cleaned);
  if (name) index.names.add(name.toLowerCase());

  const bases = [dirname(pagePath), normalizePath(basePath)].filter(Boolean);
  for (const base of bases) {
    const resolved = normalizePath(
      isAbsolutePath(cleaned) ? cleaned : resolveToAbsolute(base, cleaned),
    );
    if (looksLikeLocalMedia(resolved) || isAssetPath(resolved)) {
      index.paths.add(resolved);
      index.pathKeys.add(pathKey(resolved));
    }
    if (name && looksLikeLocalMedia(name)) {
      const siblingAsset = normalizePath(`${base}/assets/${name}`);
      index.paths.add(siblingAsset);
      index.pathKeys.add(pathKey(siblingAsset));
    }
  }
}

function createReferenceIndex(): LocalAssetReferenceIndex {
  return { paths: new Set(), pathKeys: new Set(), names: new Set() };
}

export function extractAssetReferencesFromMarkdown(
  markdown: string,
  pagePath: string,
  basePath: string,
  index: LocalAssetReferenceIndex = createReferenceIndex(),
): LocalAssetReferenceIndex {
  if (!markdown) return index;

  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    addReference(match[1] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(HTML_SRC_RE)) {
    addReference(match[1] ?? match[2] ?? match[3] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(WIKI_EMBED_RE)) {
    addReference(match[1] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(BARE_ASSETS_RE)) {
    addReference(match[0] ?? "", pagePath, basePath, index);
  }
  return index;
}

function collectReferencesFromJson(
  value: unknown,
  pagePath: string,
  basePath: string,
  index: LocalAssetReferenceIndex,
  seen: WeakSet<object>,
) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((item) =>
      collectReferencesFromJson(item, pagePath, basePath, index, seen),
    );
    return;
  }
  if (typeof value === "string") {
    extractAssetReferencesFromMarkdown(value, pagePath, basePath, index);
    addReference(value, pagePath, basePath, index);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  const node = value as Record<string, unknown>;
  for (const key of ["url", "src", "href"]) {
    const candidate = node[key];
    if (typeof candidate === "string") {
      addReference(candidate, pagePath, basePath, index);
    }
  }

  for (const nested of Object.values(node)) {
    collectReferencesFromJson(nested, pagePath, basePath, index, seen);
  }
}

function resolveLocalAssetPath(value: string, pagePath: string): string | null {
  const trimmed = cleanAssetDestination(value);
  if (shouldSkipRemoteOrInternal(trimmed)) return null;
  const path = normalizePath(
    isAbsolutePath(trimmed) ? trimmed : `${dirname(pagePath)}/${trimmed}`,
  );
  return isAssetPath(path) ? path : null;
}

async function readDirectory(
  gooseFs: GooseFs,
  path: string,
): Promise<LocalFolderEntry[]> {
  return (
    (gooseFs.readDirAsync
      ? await gooseFs.readDirAsync(path)
      : gooseFs.readDir(path)) ?? []
  );
}

async function pathExists(gooseFs: GooseFs, path: string): Promise<boolean> {
  if (gooseFs.existsAsync) return Boolean(await gooseFs.existsAsync(path));
  return Boolean(gooseFs.exists(path));
}

async function readTextFile(
  gooseFs: GooseFs,
  filePath: string,
): Promise<string | null> {
  const snapshot = getLocalMdSnapshot(filePath);
  if (typeof snapshot === "string") return snapshot;
  try {
    if (gooseFs.readFileAsync) return (await gooseFs.readFileAsync(filePath)) ?? null;
    return gooseFs.readFile(filePath);
  } catch {
    return null;
  }
}

async function collectAssetFiles(
  gooseFs: GooseFs,
  directory: string,
): Promise<LocalFolderEntry[]> {
  const entries = await readDirectory(gooseFs, directory);
  const files: LocalFolderEntry[] = [];
  for (const entry of entries) {
    if (entry.isFile) files.push(entry);
    if (entry.isDirectory)
      files.push(...(await collectAssetFiles(gooseFs, entry.path)));
  }
  return files;
}

async function collectMarkdownFilePaths(
  gooseFs: GooseFs,
  directory: string,
  basePath: string,
): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string) => {
    let entries: LocalFolderEntry[];
    try {
      entries = await readDirectory(gooseFs, dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const relative = relativePath(basePath, entry.path);
      if (shouldIgnoreLocalRelativePath(relative, [])) continue;
      if (entry.isDirectory) {
        if (/^assets$/i.test(entry.name)) continue;
        await walk(entry.path);
        continue;
      }
      if (entry.isFile && /\.(md|markdown)$/i.test(entry.name)) {
        files.push(entry.path);
      }
    }
  };
  await walk(directory);
  return files;
}

function relativePath(basePath: string, targetPath: string): string {
  const base = normalizePath(basePath).replace(/\/$/, "");
  const target = normalizePath(targetPath);
  return target.startsWith(`${base}/`) ? target.slice(base.length + 1) : target;
}

function getFileSize(gooseFs: GooseFs, entry: LocalFolderEntry): number {
  if (typeof entry.size === "number") return entry.size;
  const base64 = gooseFs.readFileBase64?.(entry.path);
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function collectReferenceIndex({
  basePath,
  pages,
  gooseFs,
}: ScanUnreferencedLocalAssetsOptions): Promise<LocalAssetReferenceIndex> {
  const normalizedBasePath = normalizePath(basePath);
  const index = createReferenceIndex();
  const seenMarkdown = new Set<string>();

  const ingestMarkdown = async (filePath: string, fallbackContent?: unknown) => {
    if (!filePath) return;
    const key = pathKey(filePath);
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
    await ingestMarkdown(page.localFilePath, page.content as JSONContent);
  }

  const diskMarkdown = await collectMarkdownFilePaths(
    gooseFs,
    normalizedBasePath,
    normalizedBasePath,
  );
  for (const filePath of diskMarkdown) {
    await ingestMarkdown(filePath);
  }

  return index;
}

export async function scanUnreferencedLocalAssets({
  basePath,
  pages,
  gooseFs,
}: ScanUnreferencedLocalAssetsOptions): Promise<UnreferencedLocalAsset[]> {
  const normalizedBasePath = normalizePath(basePath);
  const index = await collectReferenceIndex({ basePath, pages, gooseFs });
  const assetDirectories = new Set<string>([
    normalizePath(`${normalizedBasePath}/assets`),
  ]);

  for (const page of pages) {
    if (page.isFolder || !page.localFilePath) continue;
    assetDirectories.add(
      normalizePath(`${dirname(page.localFilePath)}/assets`),
    );
  }

  const assets = await Promise.all(
    [...assetDirectories].map(async (directory) => {
      try {
        return await collectAssetFiles(gooseFs, directory);
      } catch {
        return [];
      }
    }),
  );

  return assets
    .flat()
    .map((entry) => ({ ...entry, path: normalizePath(entry.path) }))
    .filter((entry) => {
      if (index.pathKeys.has(pathKey(entry.path))) return false;
      if (index.names.has(entry.name.toLowerCase())) return false;
      return true;
    })
    .map((entry) => ({
      path: entry.path,
      relativePath: relativePath(normalizedBasePath, entry.path),
      name: entry.name,
      size: getFileSize(gooseFs, entry),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function restoreMissingReferencedLocalAssets({
  basePath,
  pages,
  gooseFs,
}: ScanUnreferencedLocalAssetsOptions): Promise<RestoreMissingLocalAssetsResult> {
  const restored: string[] = [];
  const missing: string[] = [];
  if (!gooseFs.restoreFromTrash) {
    return { restored, missing };
  }

  const index = await collectReferenceIndex({ basePath, pages, gooseFs });
  const byName = new Map<string, string[]>();
  for (const assetPath of index.paths) {
    if (!isAssetPath(assetPath)) continue;
    const name = basename(assetPath).toLowerCase();
    const current = byName.get(name) ?? [];
    current.push(assetPath);
    byName.set(name, current);
  }
  for (const [name, dests] of byName) {
    const uniqueDests = [...new Set(dests.map(normalizePath))];
    const missingDests: string[] = [];
    let hasExisting = false;
    for (const dest of uniqueDests) {
      if (await pathExists(gooseFs, dest)) {
        hasExisting = true;
        break;
      }
      missingDests.push(dest);
    }
    if (hasExisting || missingDests.length === 0) continue;

    missingDests.sort((a, b) => {
      const parentRank = Number(isAssetPath(b)) - Number(isAssetPath(a));
      if (parentRank !== 0) return parentRank;
      return b.length - a.length;
    });

    let recovered = false;
    for (const dest of missingDests) {
      try {
        const ok = await gooseFs.restoreFromTrash(dest);
        if (ok) {
          restored.push(dest);
          recovered = true;
          break;
        }
      } catch {
        // try next candidate path
      }
    }
    if (!recovered) {
      missing.push(missingDests[0] ?? name);
    }
  }

  return { restored, missing };
}

export const localAssetPaths = {
  normalizePath,
  resolveLocalAssetPath,
  cleanAssetDestination,
};
