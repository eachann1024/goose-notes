import { blobToBase64 } from "@/lib/imageStorage/utils";

type HostWindow = Window & {
  utools?: {
    getPath?: (name: string) => string | null;
    shellShowItemInFolder?: (targetPath: string) => boolean | Promise<boolean>;
  };
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
  const w = hostWindow();
  if (!w) return null;

  try {
    const dir = await w.gooseDesktop?.getDownloadsPath?.();
    if (typeof dir === "string" && dir.trim()) return dir;
  } catch {
    /* ignore */
  }

  try {
    const dir = w.utools?.getPath?.("downloads");
    if (typeof dir === "string" && dir.trim()) return dir;
  } catch {
    /* ignore */
  }

  try {
    const env = (w as Window & { process?: { env?: Record<string, string> } })
      .process?.env;
    const xdg = env?.XDG_DOWNLOAD_DIR;
    if (typeof xdg === "string" && xdg.trim()) return xdg;
  } catch {
    /* ignore */
  }

  try {
    const os = (w as Window & { require?: (id: string) => unknown }).require?.(
      "os",
    ) as { homedir?: () => string } | undefined;
    const nodePath = (w as Window & { require?: (id: string) => unknown }).require?.(
      "path",
    ) as { join?: (...parts: string[]) => string } | undefined;
    if (os?.homedir && nodePath?.join) {
      return nodePath.join(os.homedir(), "Downloads");
    }
  } catch {
    /* ignore */
  }

  try {
    const env = (w as Window & { process?: { env?: Record<string, string> } })
      .process?.env;
    const home = env?.HOME || env?.USERPROFILE;
    if (home) {
      const nodePath = (
        w as Window & { require?: (id: string) => unknown }
      ).require?.("path") as { join?: (...parts: string[]) => string } | undefined;
      return nodePath?.join
        ? nodePath.join(home, "Downloads")
        : `${home.replace(/[\\/]+$/, "")}/Downloads`;
    }
  } catch {
    /* ignore */
  }

  return null;
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
  const w = hostWindow();
  if (!w) return;

  if (typeof w.gooseFs?.revealItemInFolder === "function") {
    try {
      if (await w.gooseFs.revealItemInFolder(targetPath)) return;
    } catch {
      /* ignore */
    }
  }

  if (w.gooseDesktop?.showItemInFolder) {
    try {
      await w.gooseDesktop.showItemInFolder(targetPath);
      return;
    } catch {
      /* ignore */
    }
  }

  if (w.utools?.shellShowItemInFolder) {
    try {
      await Promise.resolve(w.utools.shellShowItemInFolder(targetPath));
    } catch {
      /* ignore */
    }
  }
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

async function trySaveViaGooseFs(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  const w = hostWindow();
  const gooseFs = w?.gooseFs;
  if (!gooseFs) return false;

  const downloadsDir = await resolveDownloadsDir();
  if (!downloadsDir) return false;

  if (!(await pathExists(gooseFs, downloadsDir))) {
    try {
      await Promise.resolve(gooseFs.mkdir(downloadsDir));
    } catch {
      /* ignore */
    }
  }

  const candidateName = await nextAvailableDownloadName(
    downloadsDir,
    filename,
    (fullPath) => pathExists(gooseFs, fullPath),
    (dir, name) => joinDownloadPath(dir, name),
  );
  const targetPath = await joinDownloadPath(downloadsDir, candidateName);
  const base64 = await blobToBase64(blob);
  const payload = base64.replace(/^data:.*;base64,/, "");
  const saved = gooseFs.writeFileAsync
    ? await gooseFs.writeFileAsync(targetPath, payload, "base64")
    : await Promise.resolve(gooseFs.writeFile(targetPath, payload, "base64"));

  if (!saved) return false;
  await revealSavedFile(targetPath);
  return true;
}

function triggerBrowserDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    requestAnimationFrame(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 导出/下载一律写入用户下载目录，不弹保存对话框；
 * 成功后打开文件管理器并选中该文件。浏览器环境回退为普通下载。
 */
export async function saveBlobAndReveal(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  try {
    if (await trySaveViaElectron(blob, filename)) return true;
  } catch (error) {
    console.error("[export] Electron 保存到下载目录失败:", error);
  }

  try {
    if (await trySaveViaGooseFs(blob, filename)) return true;
  } catch (error) {
    console.error("[export] 写入下载目录失败:", error);
  }

  return triggerBrowserDownload(blob, filename);
}

export { triggerBrowserDownload };
