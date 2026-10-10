import { getGooseDesktop } from "./runtime";
import { normalizeAppName } from "./gooseFsHelpers";

export const electronGooseFsShell = {
  revealItemInFolder: async (path: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.showItemInFolder(path);
      return true;
    } catch {
      return false;
    }
  },
  listAvailableOpenApps: async <
    T extends { appName: string; aliases?: string[]; commands?: string[] },
  >(
    candidates: T[],
  ): Promise<T[]> => {
    const api = getGooseDesktop();
    if (!api) return [];
    try {
      const installed = await api.listOpenApps(
        candidates.flatMap((candidate) => [
          candidate.appName,
          ...(candidate.aliases ?? []),
          ...(candidate.commands ?? []),
        ]),
      );
      const names = new Map<string, string | undefined>();
      for (const app of installed) {
        names.set(normalizeAppName(app.name), app.icon);
        const base = app.path.split(/[\\/]/).pop() ?? "";
        names.set(
          normalizeAppName(base.replace(/\.(exe|app)$/i, "")),
          app.icon,
        );
      }
      return candidates.flatMap((candidate) => {
        const aliases = candidate.aliases ?? [];
        const commands = candidate.commands ?? [];
        const options = [candidate.appName, ...aliases, ...commands].map(
          normalizeAppName,
        );
        const matched = options.find((name) => names.has(name));
        return matched ? [{ ...candidate, icon: names.get(matched) }] : [];
      });
    } catch (err) {
      console.warn("[electron-gooseFs] listAvailableOpenApps 失败", err);
      return [];
    }
  },
  openWithApp: async (path: string, app: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openWithApp(app, path);
      return true;
    } catch {
      return false;
    }
  },
  openTerminalAtPath: async (path: string, terminal?: string) => {
    const api = getGooseDesktop();
    if (!api) return false;
    try {
      await api.openTerminalAtPath(path, terminal);
      return true;
    } catch {
      return false;
    }
  },
  printHtmlToPdf: async (html: string) => {
    const api = getGooseDesktop();
    if (!api?.printHtmlToPdf) return null;
    try {
      return await api.printHtmlToPdf(html);
    } catch (err) {
      console.warn("[electron-gooseFs] printHtmlToPdf 失败", err);
      return null;
    }
  },
};
