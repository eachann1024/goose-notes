#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  GOOSE_BUILD_TARGET: "electron",
  ELECTRON_RENDERER_URL: "http://localhost:6001",
  PATH: `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
};

const compile = spawnSync("node", ["scripts/compile-electron.mjs"], {
  stdio: "inherit",
  env,
  cwd: root,
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

const result = spawnSync(
  'concurrently -k -n vite,electron -c cyan,magenta "vite --host 0.0.0.0 --port 6001" "wait-on http://127.0.0.1:6001 --timeout 120000 && electron ."',
  { stdio: "inherit", env, shell: true, cwd: root },
);
process.exit(result.status ?? 1);
