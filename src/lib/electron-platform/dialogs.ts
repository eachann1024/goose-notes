const getGooseFs = (): GooseFs | null => typeof window !== "undefined" ? window.gooseFs ?? null : null;
export const dialogs = {
  selectDirectory: async (): Promise<string | null> => { try { return await getGooseFs()?.selectDirectory?.() ?? null; } catch { return null; } },
  restoreLastDirectory: async (): Promise<string | null> => { try { return await getGooseFs()?.restoreLastDirectory?.() ?? null; } catch { return null; } },
};
