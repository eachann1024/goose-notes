import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const required = [
  "src/lib/vite-stubs/node-fs-stub.ts",
  "src/lib/vite-stubs/lite-empty.ts",
  "src/lib/vite-stubs/pdf-font-empty.ts",
  "src/lib/vite-stubs/assert-present.mjs",
  "scripts/compile-electron.mjs",
  "scripts/prepare-electron-pack.mjs",
];

const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
if (missing.length) {
  console.error("[electron-build] 缺少桌面构建必需文件：");
  for (const rel of missing) console.error("  -", rel);
  console.error("Vite stub 必须放在 src/lib/vite-stubs/，不要放回名为 build 的目录。");
  process.exit(1);
}
