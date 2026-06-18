import { getUToolsApi } from "./env";

export const shell = {
  copyText: (text: string): void => {
    const utools = getUToolsApi();
    if (!utools) return;
    utools.copyText?.(text);
  },

  copyImage: (dataUrl: string): void => {
    const utools = getUToolsApi();
    if (!utools || typeof utools.copyImage !== "function") return;
    utools.copyImage(dataUrl);
  },

  showNotification: (body: string): void => {
    const utools = getUToolsApi();
    if (!utools) return;
    utools.showNotification?.(body);
  },

  openUrl: (url: string, useInternalBrowser = true): void => {
    const utools = getUToolsApi();
    if (!utools) return;
    if (useInternalBrowser && typeof utools?.ubrowser?.goto === "function") {
      utools.ubrowser.goto(url).run();
      return;
    }
    utools.shellOpenExternal?.(url);
  },

  openPath: async (targetPath: string): Promise<boolean> => {
    const utools = getUToolsApi();
    if (!utools || typeof utools.shellOpenPath !== "function") return false;
    try {
      const result = await Promise.resolve(utools.shellOpenPath(targetPath));
      if (typeof result === "string") return result.length === 0;
      return result !== false;
    } catch {
      return false;
    }
  },

  showItemInFolder: async (targetPath: string): Promise<boolean> => {
    const utools = getUToolsApi();
    if (!utools) return false;
    if (typeof utools.shellShowItemInFolder === "function") {
      try {
        await Promise.resolve(utools.shellShowItemInFolder(targetPath));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  openWithEditor: async (filePath: string, editor: string): Promise<boolean> => {
    type GooseFs = { openWithApp?: (f: string, e: string) => Promise<boolean> };
    const gooseFs = (window as Window & { gooseFs?: GooseFs }).gooseFs;
    if (editor && gooseFs?.openWithApp) {
      try {
        return await gooseFs.openWithApp(filePath, editor);
      } catch {
        return false;
      }
    }
    return shell.openPath(filePath);
  },

  getDownloadsPath: (): string | null => {
    const utools = getUToolsApi();
    if (!utools?.getPath) return null;
    try {
      return utools.getPath("downloads") ?? null;
    } catch {
      return null;
    }
  },
};
