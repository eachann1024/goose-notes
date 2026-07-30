import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const guideDir = path.join(root, "dist-guide");
const distDir = path.join(root, "dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");

await rm(distDir, { recursive: true, force: true });
await mkdir(clientDir, { recursive: true });
await cp(guideDir, clientDir, { recursive: true });
await copyFile(path.join(clientDir, "guide.html"), path.join(clientDir, "index.html"));
await mkdir(serverDir, { recursive: true });
await cp(path.join(root, "hosting", "worker.js"), path.join(serverDir, "index.js"));
