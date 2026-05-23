/**
 * uTools shell 操作抽象层
 * 统一封装 copyImage / showItemInFolder / openPath / getDownloadsPath，
 * 在非 uTools 环境下安全降级（no-op 或返回 null）。
 */

function getUTools(): any | null {
  if (typeof window !== "undefined" && typeof (window as any).utools !== "undefined") {
    return (window as any).utools;
  }
  return null;
}

function getGooseFs(): GooseFs | null {
  if (typeof window !== "undefined" && (window as any).gooseFs) {
    return (window as any).gooseFs as GooseFs;
  }
  return null;
}

/**
 * 复制图片到剪贴板（uTools 原生）。
 * 非 uTools 环境下静默跳过，返回 false。
 */
function copyImage(dataUrl: string): boolean {
  const utools = getUTools();
  if (utools && typeof utools.copyImage === "function") {
    utools.copyImage(dataUrl);
    return true;
  }
  return false;
}

/**
 * 在 Finder/Explorer 中高亮显示文件。
 * 优先用 gooseFs.revealItemInFolder，回退到 utools.shellShowItemInFolder。
 */
async function showItemInFolder(path: string): Promise<boolean> {
  const gooseFs = getGooseFs();
  if (gooseFs && typeof gooseFs.revealItemInFolder === "function") {
    try {
      return Boolean(await gooseFs.revealItemInFolder(path));
    } catch { /* ignore */ }
  }

  const utools = getUTools();
  if (utools && typeof utools.shellShowItemInFolder === "function") {
    try {
      return Boolean(await Promise.resolve(utools.shellShowItemInFolder(path)));
    } catch { /* ignore */ }
  }

  return false;
}

/**
 * 用系统默认程序打开路径（文件或目录）。
 */
async function openPath(path: string): Promise<boolean> {
  const utools = getUTools();
  if (utools && typeof utools.shellOpenPath === "function") {
    try {
      const result = await Promise.resolve(utools.shellOpenPath(path));
      if (typeof result === "string") return result.length === 0;
      return result !== false;
    } catch { /* ignore */ }
  }
  return false;
}

/**
 * 获取系统 Downloads 目录路径。
 * 依次尝试 utools.getPath、Node.js os/path、环境变量推断。
 */
function getDownloadsPath(): string | null {
  const w = window as any;
  const gooseFs = getGooseFs();
  const exists = (p: string): boolean => {
    try { return Boolean(gooseFs?.exists?.(p)); } catch { return false; }
  };

  // 方式0: utools.getPath
  try {
    const dir = w.utools?.getPath?.("downloads");
    if (typeof dir === "string" && dir.trim().length > 0) return dir;
  } catch { /* ignore */ }

  // 方式1: Node.js require
  try {
    const os = w.require?.("os");
    const path = w.require?.("path");
    if (os?.homedir && path?.join) {
      const dir = path.join(os.homedir(), "Downloads");
      if (exists(dir)) return dir;
    }
  } catch { /* ignore */ }

  // 方式2: process.env (Electron renderer)
  try {
    const env = w.process?.env;
    if (env) {
      const home = env.HOME || env.USERPROFILE;
      if (home) {
        const path = w.require?.("path");
        const dir = path?.join ? path.join(home, "Downloads") : `${home}/Downloads`;
        if (exists(dir)) return dir;
      }
    }
  } catch { /* ignore */ }

  // 方式3: macOS 通过用户名推断
  try {
    const env = w.process?.env;
    if (env?.USER) {
      const dir = `/Users/${env.USER}/Downloads`;
      if (exists(dir)) return dir;
    }
  } catch { /* ignore */ }

  // 方式4: Windows 通过用户名推断
  try {
    const env = w.process?.env;
    if (env?.USERNAME) {
      const sysDrive = env.SystemDrive || "C:";
      const dir = `${sysDrive}\\Users\\${env.USERNAME}\\Downloads`;
      if (exists(dir)) return dir;
    }
  } catch { /* ignore */ }

  return null;
}

export const shell = {
  copyImage,
  showItemInFolder,
  openPath,
  getDownloadsPath,
};
