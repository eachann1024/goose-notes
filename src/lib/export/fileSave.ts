import "@/lib/imageStorage/utils";

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
