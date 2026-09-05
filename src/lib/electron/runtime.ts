/**
 * Electron 运行时检测：编译期 __HOST_TARGET__ === "electron" 优先；
 * 若误把非 electron 前端包装进桌面壳（或反之调试），回退到 window.gooseDesktop。
 * Electron 构建里 gooseDesktop 不存在，结果仍为 false。
 */
export function isElectronRuntime(): boolean {
  if (typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron") {
    return true;
  }
  return typeof window !== "undefined" && Boolean(window.gooseDesktop);
}

export function getGooseDesktop(): GooseDesktop | null {
  if (typeof window === "undefined") return null;
  return window.gooseDesktop ?? null;
}

export function requireGooseDesktop(): GooseDesktop {
  const api = getGooseDesktop();
  if (!api) {
    throw new Error("window.gooseDesktop 不可用");
  }
  return api;
}
