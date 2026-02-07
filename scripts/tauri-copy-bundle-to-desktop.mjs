import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const bundleRoot = path.join(projectRoot, "src-tauri", "target", "release", "bundle");
const desktopDir = path.join(homedir(), "Desktop");
const outputDir = path.join(desktopDir, "鹅的笔记-安装包");

const collectEntries = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((filePath) => existsSync(filePath));
};

const copyTargets = [];
const macosDir = path.join(bundleRoot, "macos");

for (const filePath of collectEntries(macosDir)) {
  if (filePath.endsWith(".app")) copyTargets.push(filePath);
}

if (copyTargets.length === 0) {
  console.log("未找到可复制的 .app，跳过桌面搬运。");
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });

for (const sourcePath of copyTargets) {
  const targetPath = path.join(outputDir, path.basename(sourcePath));
  const sourceStat = statSync(sourcePath);
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
  cpSync(sourcePath, targetPath, {
    recursive: sourceStat.isDirectory(),
    force: true,
  });
}

console.log(`已复制 ${copyTargets.length} 个安装产物到: ${outputDir}`);
