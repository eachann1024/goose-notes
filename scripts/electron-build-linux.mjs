#!/usr/bin/env node
import { execSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

// Linux 桌面端打包：产出 AppImage / deb / rpm（目标在 prepare-electron-pack.mjs 生成的
// electron-builder.yml 中定义）。AppImage 可在 Omarchy / Arch 等发行版直接双击运行。
if (platform !== "linux") {
  console.error("[linux] bun run linux 面向 Linux 打包；当前平台不是 Linux。");
  console.error("       请在目标 Linux 系统（如 Omarchy / Arch）上执行。");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pack = resolve(root, "dist-electron/app-pack");

const env = {
  ...process.env,
  PATH: `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};
console.log("[linux] electron-builder --linux（AppImage / deb / rpm，未签名）");
execSync("electron-builder --linux", {
  stdio: "inherit",
  env,
  shell: true,
  cwd: pack,
});
