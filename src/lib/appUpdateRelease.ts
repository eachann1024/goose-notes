export const PUBLIC_RELEASES_REPO = "eachann1024/goose-note-app";
export const PUBLIC_RELEASES_LATEST_URL = `https://github.com/${PUBLIC_RELEASES_REPO}/releases/latest`;
export const PUBLIC_RELEASES_API_URL = `https://api.github.com/repos/${PUBLIC_RELEASES_REPO}/releases/latest`;

export type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

export type ParsedReleaseVersion = {
  version: string;
  tag: string;
};

const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/;

export function parseReleaseTag(tag: string): ParsedReleaseVersion | null {
  const trimmed = tag.trim();
  if (!trimmed) return null;
  const match = SEMVER_RE.exec(trimmed);
  if (!match) return null;
  return { version: `${match[1]}.${match[2]}.${match[3]}`, tag: trimmed };
}

export function compareSemver(a: string, b: string): number {
  const parse = (value: string) => {
    const parsed = parseReleaseTag(value);
    if (!parsed) return [0, 0, 0];
    return parsed.version.split(".").map((part) => Number(part) || 0);
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function pickUpdateAsset(
  assets: GithubReleaseAsset[],
  platform: string,
  arch: string,
): GithubReleaseAsset | null {
  const names = assets.filter((asset) => asset.name && asset.browser_download_url);
  if (names.length === 0) return null;

  const isArm = arch === "arm64";
  if (platform === "darwin") {
    const dmgs = names.filter((asset) => asset.name.toLowerCase().endsWith(".dmg"));
    if (isArm) {
      return (
        dmgs.find((asset) => asset.name.toLowerCase().includes("arm64")) ??
        names.find((asset) => asset.name.toLowerCase().includes("arm64")) ??
        null
      );
    }
    return (
      dmgs.find((asset) => !asset.name.toLowerCase().includes("arm64")) ??
      names.find(
        (asset) =>
          asset.name.toLowerCase().endsWith(".zip") &&
          !asset.name.toLowerCase().includes("arm64"),
      ) ??
      null
    );
  }

  if (platform === "win32") {
    return names.find((asset) => asset.name.toLowerCase().endsWith(".exe")) ?? null;
  }

  const linux = names.filter((asset) => {
    const lower = asset.name.toLowerCase();
    return (
      lower.endsWith(".appimage") ||
      lower.endsWith(".deb") ||
      lower.endsWith(".rpm") ||
      lower.endsWith(".pacman")
    );
  });
  const archHint = isArm ? "arm64" : "amd64";
  return (
    linux.find((asset) => asset.name.toLowerCase().endsWith(".appimage") && asset.name.toLowerCase().includes(archHint)) ??
    linux.find((asset) => asset.name.toLowerCase().endsWith(".appimage")) ??
    linux.find((asset) => asset.name.toLowerCase().includes(archHint)) ??
    linux[0] ??
    null
  );
}

export function isGithubDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "github.com" ||
      host === "objects.githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    );
  } catch {
    return false;
  }
}
