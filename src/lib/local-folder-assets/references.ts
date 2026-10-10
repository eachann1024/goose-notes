import MarkdownIt from "markdown-it";
import { isInternalAssetRef } from "../internalAssetRef";

export interface LocalAssetReferenceIndex {
  paths: Set<string>;
  pathKeys: Set<string>;
  names: Set<string>;
}

const markdownParser = new MarkdownIt({ html: true });

const MARKDOWN_LINK_RE =
  /!?\[[^\]]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const HTML_SRC_RE = /\b(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
const WIKI_EMBED_RE = /!?\[\[([^\]|#\n]+)(?:[|#][^\]]*)?\]\]/g;
const BARE_ASSETS_RE = /(?:(?:\.\.?\/)*)assets\/[^\s)\]"'<>]+/gi;
const MEDIA_FILE_RE =
  /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?|mp4|m4v|webm|mov|mkv|mp3|wav|ogg|m4a|pdf|zip|html?)$/i;

export function normalizePath(value: string): string {
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

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? normalized.slice(0, 1) : normalized.slice(0, index);
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

export function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

export function pathKey(value: string): string {
  return normalizePath(value).toLowerCase();
}

export function isAssetPath(value: string): boolean {
  return /(?:^|\/)assets(?:\/|$)/i.test(normalizePath(value));
}

function looksLikeLocalMedia(value: string): boolean {
  return (
    isAssetPath(value) ||
    getLocalAssetKind(value) !== null ||
    MEDIA_FILE_RE.test(value)
  );
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

export function createReferenceIndex(): LocalAssetReferenceIndex {
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
  for (const match of markdown.matchAll(
    /^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm,
  )) {
    addReference(match[1] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(HTML_SRC_RE)) {
    addReference(
      match[1] ?? match[2] ?? match[3] ?? "",
      pagePath,
      basePath,
      index,
    );
  }
  for (const match of markdown.matchAll(WIKI_EMBED_RE)) {
    addReference(match[1] ?? "", pagePath, basePath, index);
  }
  for (const match of markdown.matchAll(BARE_ASSETS_RE)) {
    addReference(match[0] ?? "", pagePath, basePath, index);
  }
  return index;
}

export function collectReferencesFromJson(
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

export function resolveLocalAssetPath(
  value: string,
  pagePath: string,
): string | null {
  const trimmed = cleanAssetDestination(value);
  if (shouldSkipRemoteOrInternal(trimmed)) return null;
  const path = normalizePath(
    isAbsolutePath(trimmed) ? trimmed : `${dirname(pagePath)}/${trimmed}`,
  );
  return isAssetPath(path) ? path : null;
}

export function getLocalAssetKind(name: string): "image" | "video" | null {
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic|heif|tiff?)$/i.test(name))
    return "image";
  if (/\.(mp4|m4v|webm|mov|mkv|avi|mpeg|mpg)$/i.test(name)) return "video";
  return null;
}
