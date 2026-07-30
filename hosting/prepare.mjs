import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");

await mkdir(clientDir, { recursive: true });

for (const entry of await readdir(distDir)) {
  if (entry === "client" || entry === "server") continue;
  await rename(path.join(distDir, entry), path.join(clientDir, entry));
}

await mkdir(serverDir, { recursive: true });
await copyFile(path.join(root, "hosting", "worker.js"), path.join(serverDir, "index.js"));
