import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type OpenApp = { name: string; path: string };

function macApplicationRoots(): string[] {
  return ["/Applications", path.join(homedir(), "Applications")];
}

function spawnDetached(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function listOpenApps(): Promise<OpenApp[]> {
  if (process.platform !== "darwin") return [];
  const found = new Map<string, OpenApp>();
  for (const root of macApplicationRoots()) {
    if (!existsSync(root)) continue;
    let entries: string[] = [];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      const appPath = path.join(root, entry);
      const name = entry.replace(/\.app$/i, "");
      if (!found.has(name.toLowerCase())) {
        found.set(name.toLowerCase(), { name, path: appPath });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function openWithApp(app: string, targetPath: string): boolean {
  const appName = app.trim();
  if (!appName || !targetPath) return false;
  if (process.platform === "darwin") {
    return spawnDetached("/usr/bin/open", ["-a", appName, targetPath]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "", targetPath]);
  }
  return spawnDetached("xdg-open", [targetPath]);
}

function resolveDirectoryTarget(targetPath: string): string {
  try {
    const info = statSync(targetPath);
    if (info.isDirectory()) return targetPath;
    return path.dirname(targetPath);
  } catch {
    return targetPath;
  }
}

export function openTerminalAtPath(targetPath: string): boolean {
  if (!targetPath) return false;
  const dir = resolveDirectoryTarget(targetPath);
  if (process.platform === "darwin") {
    const iterm = "/Applications/iTerm.app";
    if (existsSync(iterm)) {
      return spawnDetached("/usr/bin/open", ["-a", "iTerm", dir]);
    }
    return spawnDetached("/usr/bin/open", ["-a", "Terminal", dir]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "cmd", "/k", `cd /d "${dir}"`]);
  }
  return spawnDetached("x-terminal-emulator", ["--working-directory", dir]);
}
