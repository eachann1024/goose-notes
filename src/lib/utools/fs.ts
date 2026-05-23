/**
 * uTools 文件系统抽象层
 * 封装 window.gooseFs 的读写操作，非 uTools 环境安全降级。
 */

function getGooseFs(): GooseFs | null {
  if (typeof window !== "undefined" && (window as any).gooseFs) {
    return (window as any).gooseFs as GooseFs;
  }
  return null;
}

/** 是否可用（gooseFs 存在） */
function isAvailable(): boolean {
  return getGooseFs() !== null;
}

/**
 * 同步写文件。
 * 非 uTools 环境返回 false。
 */
function writeFile(path: string, content: string, encoding?: string): boolean {
  const gooseFs = getGooseFs();
  if (!gooseFs) return false;
  try {
    return gooseFs.writeFile(path, content, encoding);
  } catch {
    return false;
  }
}

/**
 * 异步写文件。
 * 优先调用 writeFileAsync，回退到同步 writeFile。
 * 非 uTools 环境返回 false。
 */
async function writeFileAsync(path: string, content: string, encoding?: string): Promise<boolean> {
  const gooseFs = getGooseFs();
  if (!gooseFs) return false;
  try {
    if (typeof gooseFs.writeFileAsync === "function") {
      return await gooseFs.writeFileAsync(path, content, encoding);
    }
    return await Promise.resolve(gooseFs.writeFile(path, content, encoding));
  } catch {
    return false;
  }
}

/**
 * 在 Finder/Explorer 中高亮显示文件（通过 gooseFs.revealItemInFolder）。
 */
async function revealItemInFolder(path: string): Promise<boolean> {
  const gooseFs = getGooseFs();
  if (!gooseFs || typeof gooseFs.revealItemInFolder !== "function") return false;
  try {
    return Boolean(await gooseFs.revealItemInFolder(path));
  } catch {
    return false;
  }
}

export const fs = {
  isAvailable,
  writeFile,
  writeFileAsync,
  revealItemInFolder,
};
