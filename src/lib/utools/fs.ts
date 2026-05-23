function getGooseFs(): GooseFs | undefined {
  return typeof window !== 'undefined' ? window.gooseFs : undefined;
}

export const fs = {
  isAvailable(): boolean {
    return Boolean(getGooseFs());
  },

  async existsAsync(path: string): Promise<boolean> {
    const gooseFs = getGooseFs();
    if (!gooseFs) return false;
    return gooseFs.existsAsync
      ? gooseFs.existsAsync(path)
      : Promise.resolve(gooseFs.exists(path));
  },

  exists(path: string): boolean {
    return getGooseFs()?.exists(path) ?? false;
  },

  async writeTempFile(
    relativePath: string,
    contentBase64: string,
  ): Promise<string | null> {
    const gooseFs = getGooseFs();
    if (!gooseFs?.writeTempFile) return null;
    return gooseFs.writeTempFile(relativePath, contentBase64);
  },

  async cleanupTempFiles(prefix: string, maxAgeMs: number): Promise<void> {
    await getGooseFs()?.cleanupTempFiles?.(prefix, maxAgeMs);
  },
};
