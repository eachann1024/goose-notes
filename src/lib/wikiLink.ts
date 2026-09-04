/** Obsidian / Logseq 风格双链：`[[target]]`、`[[target|alias]]`、`[[target#heading]]`。 */

const WIKI_MEDIA_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "pdf",
  "zip",
]);

export type ParsedWikiLink = {
  target: string;
  alias: string;
};

export function stripWikiMarkdownExtension(path: string): string {
  return path.replace(/\.(md|markdown)$/i, "");
}

export function normalizeWikiPath(value: string): string {
  return stripWikiMarkdownExtension(value.trim().replace(/\\/g, "/")).replace(
    /^\.\//,
    "",
  );
}

export function wikiPathKey(value: string): string {
  return normalizeWikiPath(value).toLowerCase();
}

function lastUnescapedPipeIndex(value: string): number {
  for (let i = value.length - 1; i >= 0; i--) {
    if (value[i] !== "|") continue;
    if (i > 0 && value[i - 1] === "\\") continue;
    return i;
  }
  return -1;
}

function cutHeadingOrBlock(target: string): string {
  const hash = target.indexOf("#");
  const caret = target.indexOf("^");
  let end = target.length;
  if (hash >= 0) end = Math.min(end, hash);
  if (caret >= 0) end = Math.min(end, caret);
  return target.slice(0, end).trim();
}

export function isWikiMediaTarget(target: string): boolean {
  const base = target.split("/").pop() || target;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;
  const ext = base.slice(dot + 1).toLowerCase();
  return WIKI_MEDIA_EXTENSIONS.has(ext);
}

export function parseWikiLinkInner(inner: string): ParsedWikiLink | null {
  const trimmed = inner.trim();
  if (!trimmed) return null;
  const pipe = lastUnescapedPipeIndex(trimmed);
  const targetPart = (pipe === -1 ? trimmed : trimmed.slice(0, pipe)).trim();
  const alias = (pipe === -1 ? "" : trimmed.slice(pipe + 1)).trim();
  const target = normalizeWikiPath(cutHeadingOrBlock(targetPart));
  if (!target || isWikiMediaTarget(target)) return null;
  return { target, alias };
}

export function wikiLinkDisplayTitle(parsed: ParsedWikiLink): string {
  if (parsed.alias) return parsed.alias;
  const base = parsed.target.split("/").pop() || parsed.target;
  return base || parsed.target;
}

export function serializeWikiLinkMarkdown(
  target: string,
  alias?: string,
): string {
  const safeTarget = target.replace(/\]/g, "\\]");
  const trimmedAlias = alias?.trim() ?? "";
  const targetBase = wikiLinkDisplayTitle({ target, alias: "" });
  if (trimmedAlias && wikiPathKey(trimmedAlias) !== wikiPathKey(targetBase)) {
    return `[[${safeTarget}|${trimmedAlias.replace(/\]/g, "\\]")}]]`;
  }
  return `[[${safeTarget}]]`;
}

export function wikiKeysForLocalPath(localFilePath: string): string[] {
  const posix = normalizeWikiPath(localFilePath);
  if (!posix) return [];
  const parts = posix.split("/").filter(Boolean);
  const keys: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    keys.push(wikiPathKey(parts.slice(i).join("/")));
  }
  return keys;
}
