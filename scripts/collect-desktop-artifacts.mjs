#!/usr/bin/env node
// 把桌面端最终产物收集到顶层 dist-desktop/（不再套 mac/arm64、win、linux 子目录）：
//   dist-desktop/Goose Note.app
//   dist-desktop/*.exe
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";

const LSREGISTER =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

const MARKDOWN_DOCUMENT_TYPE = {
  CFBundleTypeName: "Markdown",
  CFBundleTypeExtensions: ["md", "markdown"],
  CFBundleTypeRole: "Editor",
  CFBundleTypeIconFile: "icon",
  LSItemContentTypes: ["net.daringfireball.markdown"],
  LSHandlerRank: "Default",
};

function patchMacAppInfoPlist(appPath) {
  const plistPath = join(appPath, "Contents/Info.plist");
  if (!existsSync(plistPath)) return;

  const json = execSync(`plutil -convert json -o - "${plistPath}"`, {
    encoding: "utf8",
  });
  const info = JSON.parse(json);
  info.CFBundleDocumentTypes = [MARKDOWN_DOCUMENT_TYPE];

  const tmpJson = join(tmpdir(), `goose-info-${Date.now()}.json`);
  writeFileSync(tmpJson, JSON.stringify(info));
  try {
    execSync(`plutil -convert xml1 -o "${plistPath}" "${tmpJson}"`, {
      stdio: "pipe",
    });
  } finally {
    rmSync(tmpJson, { force: true });
  }
}

function registerMacAppWithLaunchServices(appPath) {
  if (!existsSync(LSREGISTER)) return;
  execSync(`"${LSREGISTER}" -f "${appPath}"`, { stdio: "inherit" });
}

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

  mkdirSync(outRoot, { recursive: true });
  rmSync(join(outRoot, "mac"), { recursive: true, force: true });
  for (const entry of found) {
    for (const app of entry.apps) {
      const dest = join(outRoot, app);
      rmSync(dest, { recursive: true, force: true });
      cpSync(join(entry.src, app), dest, { recursive: true, verbatimSymlinks: true });
      if (platform === "darwin") {
        patchMacAppInfoPlist(dest);
        registerMacAppWithLaunchServices(dest);
      }
    }
    console.log(`  mac ${entry.label} → dist-desktop/${entry.apps.join(", ")}`);
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
  mkdirSync(outRoot, { recursive: true });
  rmSync(join(outRoot, "win"), { recursive: true, force: true });
  for (const exe of exes) {
    const base = exe.split(/[/\\]/).pop();
    cpSync(exe, join(outRoot, base));
  }
  console.log(`  win → dist-desktop/${exes.map((p) => p.split(/[/\\]/).pop()).join(", ")}`);
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
  mkdirSync(outRoot, { recursive: true });
  rmSync(join(outRoot, "linux"), { recursive: true, force: true });
  for (const art of artifacts) {
    const base = art.split(/[/\\]/).pop();
    cpSync(art, join(outRoot, base));
  }
  console.log(`  linux → dist-desktop/${artifacts.map((p) => p.split(/[/\\]/).pop()).join(", ")}`);
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
