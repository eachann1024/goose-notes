const getGooseFs = (): GooseFs | null =>
  typeof window !== "undefined" ? (window as any).gooseFs ?? null : null;

export const fs = {
  isAvailable: (): boolean => Boolean(getGooseFs()),

  readFile: (path: string): string | null =>
    getGooseFs()?.readFile(path) ?? null,

  readFileAsync: async (path: string): Promise<string | null> => {
    const gfs = getGooseFs();
    if (!gfs) return null;
    if (gfs.readFileAsync) return gfs.readFileAsync(path);
    return gfs.readFile(path);
  },

  exists: (path: string): boolean => getGooseFs()?.exists(path) ?? false,

  existsAsync: async (path: string): Promise<boolean> => {
    const gfs = getGooseFs();
    if (!gfs) return false;
    if (gfs.existsAsync) return gfs.existsAsync(path);
    return gfs.exists(path);
  },

  mkdir: async (path: string): Promise<boolean> => {
    const gfs = getGooseFs();
    if (!gfs?.mkdir) return false;
    return Boolean(await Promise.resolve(gfs.mkdir(path)));
  },

  writeFile: (path: string, content: string, encoding?: string): boolean =>
    getGooseFs()?.writeFile(path, content, encoding) ?? false,

  deleteFile: async (path: string): Promise<boolean> => {
    const gfs = getGooseFs();
    if (!gfs) return false;
    return Boolean(await Promise.resolve(gfs.deleteFile(path)));
  },

  rename: async (oldPath: string, newPath: string): Promise<boolean> => {
    const gfs = getGooseFs();
    if (!gfs) return false;
    return Boolean(await Promise.resolve(gfs.rename(oldPath, newPath)));
  },

  watch: (path: string, cb: (eventType: string, filename: string) => void): any =>
    getGooseFs()?.watch(path, cb),

  unwatch: (path: string): void => getGooseFs()?.unwatch(path),
};
