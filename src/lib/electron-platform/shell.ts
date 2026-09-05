import { getGooseDesktop } from "@/lib/electron/runtime";
import type { LocalFolderOpenAppCandidate } from "@/lib/local-folder-open-apps";
const cached = new Map<string, LocalFolderOpenAppCandidate[]>();
const signature = (items: LocalFolderOpenAppCandidate[]) => JSON.stringify(items);
export const getCachedAvailableOpenApps = <T extends LocalFolderOpenAppCandidate>(items: T[]): T[] | null => (cached.get(signature(items)) as T[] | undefined) ?? null;
export const shell = {
  copyText: (text: string) => { void getGooseDesktop()?.writeText(text); },
  copyImage: (dataUrl: string) => { void getGooseDesktop()?.writeImage?.(dataUrl); },
  showNotification: (body: string) => { void getGooseDesktop()?.notify({ title: "Goose Note", body }); },
  openUrl: (url: string) => { void getGooseDesktop()?.openUrl(url); },
  openPath: async (path: string) => { try { await getGooseDesktop()?.openPath(path); return true; } catch { return false; } },
  showItemInFolder: async (path: string) => { try { await getGooseDesktop()?.showItemInFolder(path); return true; } catch { return false; } },
  openWithEditor: async (path: string, app: string) => shell.openWithApp(path, app),
  openWithApp: async (path: string, app: string) => Boolean(await window.gooseFs?.openWithApp?.(path, app)),
  openTerminalAtPath: async (path: string, terminal: string) => Boolean(await window.gooseFs?.openTerminalAtPath?.(path, terminal || undefined)),
  listAvailableOpenApps: async <T extends LocalFolderOpenAppCandidate>(items: T[]): Promise<T[]> => { const result = await window.gooseFs?.listAvailableOpenApps?.(items) ?? []; cached.set(signature(items), result); return result as T[]; },
};
