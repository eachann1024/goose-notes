import { app, autoUpdater, BrowserWindow, shell } from "electron";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { addSessionAllowed } from "./allowlist";
import { markQuitting } from "./windows";
import {
  nextAvailableDownloadName,
  sanitizeDownloadFilename,
} from "./saveToDownloads";
import {
  PUBLIC_UPDATE_URL,
  PUBLIC_RELEASES_LATEST_URL,
  PUBLIC_RELEASES_REPO,
  compareSemver,
  isGithubDownloadUrl,
  parseReleaseTag,
  pickUpdateAsset,
  type GithubReleaseAsset,
} from "../../src/lib/appUpdateRelease";

export type UpdateCheckResult =
  | {
      status: "up-to-date";
      currentVersion: string;
      latestVersion: string;
      releaseUrl: string;
    }
  | {
      status: "available";
      currentVersion: string;
      latestVersion: string;
      assetName: string;
      downloadUrl: string;
      releaseUrl: string;
    }
  | {
      status: "unavailable";
      currentVersion: string;
      reason: string;
      releaseUrl: string;
    };

type GithubLatestRelease = {
  tag_name?: string;
  html_url?: string;
  assets?: GithubReleaseAsset[];
};

let readyVersion = "";
let updaterStarted = false;
let updateChecking = false;

export function getReadyUpdate(): string {
  return readyVersion;
}

export function installReadyUpdate(): void {
  if (!readyVersion) throw new Error("没有已下载的更新");
  markQuitting();
  autoUpdater.quitAndInstall();
}

export function startAutomaticUpdates(): void {
  if (updaterStarted || !app.isPackaged || process.platform !== "darwin") return;
  // ponytail: only Developer ID signed macOS bundles use Squirrel.Mac; unsigned builds keep manual installation.
  // Enable this path for unsigned builds only after a platform-supported, verified installer exists.
  const signature = spawnSync("/usr/bin/codesign", ["-dv", "--verbose=2", process.execPath], { encoding: "utf8" });
  if (signature.status !== 0 || !/^Authority=Developer ID Application/m.test(signature.stderr)) return;
  updaterStarted = true;
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  autoUpdater.setFeedURL({ url: `https://raw.githubusercontent.com/${PUBLIC_RELEASES_REPO}/main/updates/mac-${arch}.json`, serverType: "json" });
  autoUpdater.on("update-downloaded", (_event, _notes, version) => {
    updateChecking = false;
    readyVersion = version;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("desktop:update-ready", version);
  });
  autoUpdater.on("update-not-available", () => { updateChecking = false; });
  autoUpdater.on("error", (error) => {
    updateChecking = false;
    console.error("[update] 自动更新失败:", error.message);
  });
  const check = () => {
    if (updateChecking || readyVersion) return;
    updateChecking = true;
    try { autoUpdater.checkForUpdates(); }
    catch (error) { updateChecking = false; console.error("[update] 检查失败:", error); }
  };
  setTimeout(check, 15_000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

function userAgent(): string {
  return `Goose-Note/${app.getVersion()}`;
}

export function getAppVersion(): string {
  return app.getVersion();
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getAppVersion();
  const releaseUrl = PUBLIC_RELEASES_LATEST_URL;
  try {
    const response = await fetch(`${PUBLIC_UPDATE_URL}?t=${Date.now()}`, {
      headers: {
        "User-Agent": userAgent(),
      },
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        currentVersion,
        reason: `无法读取更新信息（${response.status}）`,
        releaseUrl,
      };
    }
    const payload = (await response.json()) as GithubLatestRelease;
    const parsed = parseReleaseTag(String(payload.tag_name ?? ""));
    if (!parsed) {
      return {
        status: "unavailable",
        currentVersion,
        reason: "更新信息无法识别版本号",
        releaseUrl,
      };
    }
    const asset = pickUpdateAsset(
      payload.assets ?? [],
      process.platform,
      process.arch,
    );
    if (compareSemver(currentVersion, parsed.version) >= 0) {
      return {
        status: "up-to-date",
        currentVersion,
        latestVersion: parsed.version,
        releaseUrl: payload.html_url || releaseUrl,
      };
    }
    if (!asset) {
      return {
        status: "unavailable",
        currentVersion,
        reason: "已有新版本，但没有适合当前系统的安装包",
        releaseUrl: payload.html_url || releaseUrl,
      };
    }
    return {
      status: "available",
      currentVersion,
      latestVersion: parsed.version,
      assetName: asset.name,
      downloadUrl: asset.browser_download_url,
      releaseUrl: payload.html_url || releaseUrl,
    };
  } catch (error) {
    return {
      status: "unavailable",
      currentVersion,
      reason: error instanceof Error ? error.message : "检查更新失败",
      releaseUrl,
    };
  }
}

export async function downloadAppUpdate(
  downloadUrl: string,
  filename: string,
): Promise<{ path: string }> {
  const latest = await fetch(`${PUBLIC_UPDATE_URL}?t=${Date.now()}`);
  if (!latest.ok) throw new Error(`无法校验更新信息（${latest.status}）`);
  const manifest = (await latest.json()) as GithubLatestRelease;
  const asset = manifest.assets?.find((item) => item.name === filename && item.browser_download_url === downloadUrl);
  if (!asset?.sha256 || !/^[a-f0-9]{64}$/i.test(asset.sha256) || !isGithubDownloadUrl(downloadUrl)) {
    throw new Error("更新地址不受信任");
  }
  const response = await fetch(downloadUrl, {
    headers: { "User-Agent": userAgent() },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`下载失败（${response.status}）`);
  }

  const downloads = app.getPath("downloads");
  await mkdir(downloads, { recursive: true });
  const safeName = sanitizeDownloadFilename(filename);
  const uniqueName = nextAvailableDownloadName(safeName, (candidate) =>
    existsSync(path.join(downloads, candidate)),
  );
  const target = path.join(downloads, uniqueName);
  const nodeStream = Readable.fromWeb(response.body as never);
  const file = await open(target, "wx");
  try {
    const digest = createHash("sha256");
    nodeStream.on("data", (chunk: Buffer) => digest.update(chunk));
    await pipeline(nodeStream, file.createWriteStream());
    if (digest.digest("hex").toLowerCase() !== asset.sha256.toLowerCase()) throw new Error("安装包校验失败");
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
  addSessionAllowed(target);
  return { path: target };
}

export function revealDownloadedUpdate(filePath: string): void {
  shell.showItemInFolder(filePath);
}
