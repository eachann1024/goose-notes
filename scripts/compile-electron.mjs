#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcemap =
  process.env.GOOSE_DEBUG === "1" || Boolean(process.env.ELECTRON_RENDERER_URL);

mkdirSync(resolve(root, "dist-electron/main"), { recursive: true });
mkdirSync(resolve(root, "dist-electron/preload"), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [resolve(root, "electron/main/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(root, "dist-electron/main/index.js"),
  external: ["electron"],
  sourcemap,
  logLevel: "info",
});

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [resolve(root, "electron/preload/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: resolve(root, "dist-electron/preload/index.cjs"),
  external: ["electron"],
  sourcemap,
  logLevel: "info",
});

console.log("[electron] compiled main + preload");
