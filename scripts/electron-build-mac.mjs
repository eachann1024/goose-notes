#!/usr/bin/env node
import { execSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

if (platform !== "darwin") {
  console.error("[mac] bun run mac 仅支持 macOS（产出 Apple Silicon arm64 .app）");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pack = resolve(root, "dist-electron/app-pack");

const env = {
  ...process.env,
  PATH: `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};
console.log("[mac] electron-builder --mac --arm64（dir 目标，未签名）");
execSync("electron-builder --mac --arm64 --config.mac.target=dir", {
  stdio: "inherit",
  env,
  shell: true,
  cwd: pack,
});
