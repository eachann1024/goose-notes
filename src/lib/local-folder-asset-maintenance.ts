import MarkdownIt from "markdown-it";
import type { JSONContent, Page } from "@/types";
import { isInternalAssetRef } from "./internalAssetRef";
import { getLocalMdSnapshot } from "./local-md-snapshot";

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

export interface AssetMaintenanceFs {
  readDir: (path: string) => LocalFolderEntry[];
  readDirAsync?: (path: string) => Promise<LocalFolderEntry[]>;
  readFile: (path: string) => string | null;
  readFileAsync?: (path: string) => Promise<string | null>;
  exists: (path: string) => boolean;
  existsAsync?: (path: string) => Promise<boolean>;
  readFileBase64?: (path: string) => string | null;
  restoreFromTrash?: (path: string) => Promise<boolean>;
}

interface ScanUnreferencedLocalAssetsOptions {
  basePath: string;
  pages: Pick<Page, "content" | "localFilePath" | "isFolder">[];
  gooseFs: AssetMaintenanceFs;
}

interface LocalAssetReferenceIndex {
  paths: Set<string>;
  pathKeys: Set<string>;
  names: Set<string>;
}

const markdownParser = new MarkdownIt({ html: true });

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
  return isAssetPath(value) || getLocalAssetKind(value) !== null || MEDIA_FILE_RE.test(value);
}

export function cleanAssetDestination(raw: string): string {
  let value = markdownParser.utils.unescapeAll(raw.trim());
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
      value = fileUrl.pathname;
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
  if (!looksLikeLocalMedia(cleaned)) return;

  const name = basename(cleaned);
  if (name) index.names.add(name.toLowerCase());

  const bases = [dirname(pagePath), normalizePath(basePath)].filter(Boolean);
  for (const base of bases) {
    const resolved = normalizePath(
      isAbsolutePath(cleaned) ? cleaned : `${base}/${cleaned}`,
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

  const visitTokens = (tokens: ReturnType<MarkdownIt["parse"]>) => {
    for (const token of tokens) {
      for (const attr of ["src", "href"]) {
        const destination = token.attrGet(attr);
        if (destination) addReference(destination, pagePath, basePath, index);
      }
      if (token.children) visitTokens(token.children);
    }
  };
  visitTokens(markdownParser.parse(markdown, {}));
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    addReference(match[1] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)) {
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
  gooseFs: AssetMaintenanceFs,
  path: string,
): Promise<LocalFolderEntry[]> {
  const entries = gooseFs.readDirAsync
    ? await gooseFs.readDirAsync(path)
    : gooseFs.readDir(path);
  if (!Array.isArray(entries)) throw new Error(`无法读取目录：${path}`);
  return entries;
}

async function pathExists(gooseFs: AssetMaintenanceFs, path: string): Promise<boolean> {
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
  if (typeof text !== "string") throw new Error(`无法读取 Markdown：${filePath}`);
  return text;
}

export function getLocalAssetKind(name: string): "image" | "video" | null {
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic|heif|tiff?)$/i.test(name)) return "image";
  if (/\.(mp4|m4v|webm|mov|mkv|avi|mpeg|mpg)$/i.test(name)) return "video";
  return null;
}

function isWithin(basePath: string, target: string): boolean {
  return normalizePath(target).startsWith(`${normalizePath(basePath).replace(/\/$/, "")}/`);
}

// 包含隐藏目录以及 assets 中的 Markdown；不读取 JS/CSS 等其它文件内容。
async function collectNotebookFiles(gooseFs: AssetMaintenanceFs, basePath: string) {
  const markdown: string[] = [];
  const assets: LocalFolderEntry[] = [];
  const seen = new Set<string>();
  const walk = async (directory: string) => {
    if (seen.has(directory)) throw new Error(`目录循环：${directory}`);
    seen.add(directory);
    const entries = await readDirectory(gooseFs, directory);
    for (const entry of entries) {
      if (!isWithin(basePath, entry.path) || dirname(entry.path) !== normalizePath(directory)) {
        throw new Error(`扫描路径超出笔记本：${entry.path}`);
      }
      if (entry.isDirectory) await walk(entry.path);
      if (!entry.isFile) continue;
      if (/\.(md|markdown)$/i.test(entry.name)) markdown.push(entry.path);
      if (getLocalAssetKind(entry.name) && /(?:^|\/)assets\//i.test(relativePath(basePath, entry.path))) {
        assets.push(entry);
      }
    }
  };
  await walk(normalizePath(basePath));
  return { markdown, assets };
}

function relativePath(basePath: string, targetPath: string): string {
  const base = normalizePath(basePath).replace(/\/$/, "");
  const target = normalizePath(targetPath);
  return target.startsWith(`${base}/`) ? target.slice(base.length + 1) : target;
}

function getFileSize(gooseFs: AssetMaintenanceFs, entry: LocalFolderEntry): number {
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
}: ScanUnreferencedLocalAssetsOptions, diskMarkdown?: string[]): Promise<LocalAssetReferenceIndex> {
  const normalizedBasePath = normalizePath(basePath);
  const index = createReferenceIndex();
  const seenMarkdown = new Set<string>();

  const ingestMarkdown = async (filePath: string, fallbackContent?: unknown) => {
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
    collectReferencesFromJson(page.content as JSONContent, page.localFilePath, normalizedBasePath, index, new WeakSet());
    const snapshot = getLocalMdSnapshot(page.localFilePath);
    if (snapshot !== undefined) extractAssetReferencesFromMarkdown(snapshot, page.localFilePath, normalizedBasePath, index);
  }

  for (const filePath of diskMarkdown ?? (await collectNotebookFiles(gooseFs, normalizedBasePath)).markdown) {
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
  if (!isAbsolutePath(basePath)) throw new Error("请选择本地文件夹笔记本");
  const files = await collectNotebookFiles(gooseFs, normalizedBasePath);
  const index = await collectReferenceIndex({ basePath, pages, gooseFs }, files.markdown);
  return files.assets
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
