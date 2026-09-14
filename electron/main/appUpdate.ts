import { app, shell } from "electron";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { addSessionAllowed } from "./allowlist";
import {
  nextAvailableDownloadName,
  sanitizeDownloadFilename,
} from "./saveToDownloads";
import {
  PUBLIC_RELEASES_API_URL,
  PUBLIC_RELEASES_LATEST_URL,
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
    const response = await fetch(PUBLIC_RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
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
  if (!isGithubDownloadUrl(downloadUrl)) {
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
  await pipeline(nodeStream, createWriteStream(target));
  addSessionAllowed(target);
  return { path: target };
}

export function revealDownloadedUpdate(filePath: string): void {
  shell.showItemInFolder(filePath);
}
