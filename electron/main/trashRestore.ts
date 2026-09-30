import { existsSync } from "node:fs";
import { copyFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function trashCandidateDirs(): string[] {
  if (process.platform === "darwin") {
    return [path.join(os.homedir(), ".Trash")];
  }
  if (process.platform === "linux") {
    return [path.join(os.homedir(), ".local/share/Trash/files")];
  }
  return [];
}

export async function restoreFileFromTrash(destPath: string): Promise<boolean> {
  if (!destPath || existsSync(destPath)) return false;
  const name = path.basename(destPath);
  if (!name || name === "." || name === "..") return false;

  const matches: { path: string; mtimeMs: number }[] = [];
  for (const dir of trashCandidateDirs()) {
    if (!existsSync(dir)) continue;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name !== name) continue;
      const full = path.join(dir, entry.name);
      try {
        const info = await stat(full);
        matches.push({ path: full, mtimeMs: info.mtimeMs });
      } catch {
        // skip unreadable trash entries
      }
    }
  }
  if (matches.length === 0) return false;
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const source = matches[0]?.path;
  if (!source) return false;
  await copyFile(source, destPath);
  try {
    await rm(source, { force: true });
  } catch {
    // restored copy is enough
  }
  return existsSync(destPath);
}
