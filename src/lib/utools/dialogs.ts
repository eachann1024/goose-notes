const getGooseFs = (): GooseFs | null =>
  typeof window !== "undefined" ? (window as any).gooseFs ?? null : null;

export const dialogs = {
  selectDirectory: async (): Promise<string | null> => {
    const gooseFs = getGooseFs();
    if (!gooseFs?.selectDirectory) return null;
    try {
      return await gooseFs.selectDirectory();
    } catch {
      return null;
    }
  },
};
