#!/usr/bin/env node
// 把桌面端最终产物收集到顶层 dist-desktop/：
//   dist-desktop/mac/arm64/Goose Note.app
//   dist-desktop/win/*.exe
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagedRoot = resolve(root, "dist-electron/packaged");
const outRoot = resolve(root, "dist-desktop");

function listApps(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".app"));
}

function collectMac() {
  const candidates = [
    { src: join(packagedRoot, "mac-arm64"), destDir: "arm64", label: "Apple Silicon (arm64)" },
    { src: join(packagedRoot, "mac", "arm64"), destDir: "arm64", label: "Apple Silicon (arm64)" },
  ];

  const found = [];
  const seen = new Set();
  for (const entry of candidates) {
    const apps = listApps(entry.src);
    if (apps.length === 0) continue;
    if (seen.has(entry.destDir)) continue;
    seen.add(entry.destDir);
    found.push({ ...entry, apps });
  }

  if (found.length === 0) return false;

  const dest = join(outRoot, "mac");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of found) {
    const archDest = join(dest, entry.destDir);
    mkdirSync(archDest, { recursive: true });
    for (const app of entry.apps) {
      cpSync(join(entry.src, app), join(archDest, app), { recursive: true, verbatimSymlinks: true });
    }
    console.log(`  mac ${entry.label} → dist-desktop/mac/${entry.destDir}/${entry.apps.join(", ")}`);
  }
  return true;
}

function collectWin() {
  if (!existsSync(packagedRoot)) return false;
  const exes = [];
  const stack = [packagedRoot];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        if (name === "mac" || name.startsWith("mac-")) continue;
        stack.push(full);
      } else if (name.endsWith(".exe")) {
        exes.push(full);
      }
    }
  }
  if (exes.length === 0) return false;
  const dest = join(outRoot, "win");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const exe of exes) {
    const base = exe.split(/[/\\]/).pop();
    cpSync(exe, join(dest, base));
  }
  console.log(`  win → dist-desktop/win/${exes.map((p) => p.split(/[/\\]/).pop()).join(", ")}`);
  return true;
}

function collectLinux() {
  if (!existsSync(packagedRoot)) return false;
  const artifacts = [];
  const stack = [packagedRoot];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        if (name === "mac" || name.startsWith("mac-") || name === "win" || name.startsWith("win-")) continue;
        stack.push(full);
      } else if (/\.(AppImage|deb|rpm|snap|pacman)$/.test(name)) {
        artifacts.push(full);
      }
    }
  }
  if (artifacts.length === 0) return false;
  const dest = join(outRoot, "linux");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const art of artifacts) {
    const base = art.split(/[/\\]/).pop();
    cpSync(art, join(dest, base));
  }
  console.log(`  linux → dist-desktop/linux/${artifacts.map((p) => p.split(/[/\\]/).pop()).join(", ")}`);
  return true;
}

const gotMac = collectMac();
const gotWin = collectWin();
const gotLinux = collectLinux();

if (!gotMac && !gotWin && !gotLinux) {
  console.error("[collect] 未找到任何桌面端产物（请先执行 bun run mac / bun run win / bun run linux）");
  process.exit(1);
}
console.log(`[collect] 产物已收集到 ${outRoot}/`);
