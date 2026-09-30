import { blobToBase64 } from "@/lib/imageStorage/utils";

type HostWindow = Window & {
  gooseDesktop?: {
    getDownloadsPath?: () => Promise<string>;
    joinPath?: (...parts: string[]) => Promise<string>;
    saveToDownloads?: (filename: string, data: Uint8Array) => Promise<string>;
    showItemInFolder?: (targetPath: string) => Promise<void>;
  };
  gooseFs?: GooseFs & {
    revealItemInFolder?: (targetPath: string) => boolean | Promise<boolean>;
  };
};

function hostWindow(): HostWindow | null {
  if (typeof window === "undefined") return null;
  return window as HostWindow;
}

function joinWithSeparator(dir: string, name: string): string {
  const separator = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${name}`;
}

async function resolveDownloadsDir(): Promise<string | null> {
  try {
    const dir = await hostWindow()?.gooseDesktop?.getDownloadsPath?.();
    return typeof dir === "string" && dir.trim() ? dir : null;
  } catch { return null; }
}
async function joinDownloadPath(dir: string, name: string): Promise<string> {
  const w = hostWindow();
  try {
    const joined = await w?.gooseDesktop?.joinPath?.(dir, name);
    if (typeof joined === "string" && joined.trim()) return joined;
  } catch {
    /* ignore */
  }
  return joinWithSeparator(dir, name);
}

/** 下载目录已有同名文件时，按系统习惯加 ` (1)`、` (2)`，避免覆盖失败看起来像没导出。 */
export function nextAvailableFilename(
  filename: string,
  exists: (candidate: string) => boolean,
): string {
  if (!exists(filename)) return filename;
  const extMatch = filename.match(/(\.[^.]+)$/);
  const ext = extMatch?.[1] ?? "";
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  let index = 1;
  let candidate = `${stem} (${index})${ext}`;
  while (exists(candidate)) {
    index += 1;
    candidate = `${stem} (${index})${ext}`;
  }
  return candidate;
}

async function nextAvailableDownloadName(
  downloadsDir: string,
  filename: string,
  exists: (fullPath: string) => Promise<boolean>,
  join: (dir: string, name: string) => Promise<string>,
): Promise<string> {
  if (!(await exists(await join(downloadsDir, filename)))) return filename;
  const extMatch = filename.match(/(\.[^.]+)$/);
  const ext = extMatch?.[1] ?? "";
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  let index = 1;
  let candidate = `${stem} (${index})${ext}`;
  while (await exists(await join(downloadsDir, candidate))) {
    index += 1;
    candidate = `${stem} (${index})${ext}`;
  }
  return candidate;
}

async function pathExists(
  gooseFs: GooseFs,
  targetPath: string,
): Promise<boolean> {
  try {
    if (typeof gooseFs.existsAsync === "function") {
      return Boolean(await gooseFs.existsAsync(targetPath));
    }
    return Boolean(gooseFs.exists(targetPath));
  } catch {
    return false;
  }
}

async function revealSavedFile(targetPath: string): Promise<void> {
  await hostWindow()?.gooseDesktop?.showItemInFolder?.(targetPath);
}
async function trySaveViaElectron(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  const api = hostWindow()?.gooseDesktop;
  if (!api?.saveToDownloads) return false;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const targetPath = await api.saveToDownloads(filename, bytes);
  if (typeof targetPath !== "string" || !targetPath.trim()) return false;
  await revealSavedFile(targetPath);
  return true;
}

export async function saveBlobAndReveal(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  try {
    return await trySaveViaElectron(blob, filename);
  } catch (error) {
    console.error("[export] Electron 保存到下载目录失败:", error);
    return false;
  }
}
