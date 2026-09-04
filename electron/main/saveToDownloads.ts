import { app } from "electron";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { addSessionAllowed } from "./allowlist";

export function sanitizeDownloadFilename(filename: string): string {
  const base =
    String(filename || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.trim() || "download";
  return base.replace(/[<>:"|?*\0]/g, "_") || "download";
}

export function nextAvailableDownloadName(
  filename: string,
  exists: (candidate: string) => boolean,
): string {
  if (!exists(filename)) return filename;
  const extMatch = filename.match(/(\.[^.]+)$/);
  const ext = extMatch?.[1] ?? "";
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  let index = 1;
  let candidate = `${stem} (${index})${ext}`;
  while (exists(candidate)) {
    index += 1;
    candidate = `${stem} (${index})${ext}`;
  }
  return candidate;
}

export async function saveToDownloads(
  filename: string,
  data: Uint8Array,
): Promise<string> {
  const downloads = app.getPath("downloads");
  await mkdir(downloads, { recursive: true });
  const safeName = sanitizeDownloadFilename(filename);
  const uniqueName = nextAvailableDownloadName(safeName, (candidate) =>
    existsSync(path.join(downloads, candidate)),
  );
  const target = path.join(downloads, uniqueName);
  await writeFile(target, Buffer.from(data));
  addSessionAllowed(target);
  return target;
}
