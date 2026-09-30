import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AssetMaintenanceFs } from "../../src/lib/local-folder-asset-maintenance";

export function isInsideNotebook(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

/** 不跟随目录或文件符号链接；遇到链接即停止，不能把无法检查的 Markdown 当成无引用。 */
export async function assertNotebookPath(root: string, target: string): Promise<string> {
  const resolved = path.resolve(target);
  if (resolved !== root && !isInsideNotebook(root, resolved)) throw new Error("路径超出所选笔记本");
  const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`笔记本包含符号链接，请移除链接后再扫描：${current}`);
  }
  const canonical = await realpath(resolved);
  if (canonical !== root && !isInsideNotebook(root, canonical)) throw new Error("实际路径超出所选笔记本");
  return canonical;
}

export function notebookScanFs(root: string): AssetMaintenanceFs {
  const syncUnavailable = (): never => { throw new Error("必须使用异步文件读取"); };
  return {
    readDir: syncUnavailable,
    readFile: syncUnavailable,
    exists: syncUnavailable,
    readDirAsync: async (directory) => {
      await assertNotebookPath(root, directory);
      const entries = await readdir(directory, { withFileTypes: true });
      return Promise.all(entries.map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`笔记本包含符号链接：${filePath}`);
        const info = await lstat(filePath);
        return { name: entry.name, path: filePath, isFile: info.isFile(), isDirectory: info.isDirectory(), size: info.size };
      }));
    },
    readFileAsync: async (filePath) => readFile(await assertNotebookPath(root, filePath), "utf8"),
  };
}

export async function assetFingerprint(root: string, filePath: string): Promise<string> {
  await assertNotebookPath(root, filePath);
  const info = await lstat(filePath);
  if (!info.isFile()) throw new Error("资源不再是普通文件");
  // stat 加内容摘要：即使同大小替换/保留 mtime，也不能删除过期扫描指向的新文件。
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  const hash = digest.digest("hex");
  return `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}:${hash}`;
}
