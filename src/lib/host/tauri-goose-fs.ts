const LAST_SELECTED_DIRECTORY_KEY = "goose-note:tauri:last-directory";

const normalizeSlash = (value: string) => value.replace(/\\/g, "/");

const joinPath = (dir: string, name: string) =>
  normalizeSlash(`${dir.replace(/[\\/]+$/, "")}/${name.replace(/^[\\/]+/, "")}`);

const decodeBase64 = (data: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const tauriGooseFs: GooseFs = {
  readDir: () => {
    console.warn("[gooseFs/tauri] Sync readDir is not supported, use readDirAsync.");
    return [];
  },

  readDirAsync: async (dirPath: string) => {
    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(dirPath);
      return entries.map((entry) => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        path: joinPath(dirPath, entry.name),
      }));
    } catch (error) {
      console.error("[gooseFs/tauri] readDirAsync failed:", error);
      return [];
    }
  },

  readFile: () => {
    console.warn("[gooseFs/tauri] Sync readFile is not supported, use readFileAsync.");
    return null;
  },

  readFileAsync: async (filePath: string) => {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      return await readTextFile(filePath);
    } catch (error) {
      console.error("[gooseFs/tauri] readFileAsync failed:", error);
      return null;
    }
  },

  writeFile: () => {
    console.warn("[gooseFs/tauri] Sync writeFile is not supported, use writeFileAsync.");
    return false;
  },

  writeFileAsync: async (filePath: string, content: string, encoding?: string) => {
    try {
      if (encoding === "base64") {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(filePath, decodeBase64(content), { create: true });
        return true;
      }

      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(filePath, content, { create: true });
      return true;
    } catch (error) {
      console.error("[gooseFs/tauri] writeFileAsync failed:", error);
      return false;
    }
  },

  exists: () => false,

  existsAsync: async (filePath: string) => {
    try {
      const { exists } = await import("@tauri-apps/plugin-fs");
      return await exists(filePath);
    } catch (error) {
      console.error("[gooseFs/tauri] existsAsync failed:", error);
      return false;
    }
  },

  watch: () => null,
  unwatch: () => {},

  mkdir: async (dirPath: string) => {
    try {
      const { mkdir } = await import("@tauri-apps/plugin-fs");
      await mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error("[gooseFs/tauri] mkdir failed:", error);
      return false;
    }
  },

  deleteFile: async () => {
    console.warn("[gooseFs/tauri] deleteFile is disabled in Phase 1.");
    return false;
  },

  deleteDir: async () => {
    console.warn("[gooseFs/tauri] deleteDir is disabled in Phase 1.");
    return false;
  },

  rename: async (oldPath: string, newPath: string) => {
    try {
      const { rename } = await import("@tauri-apps/plugin-fs");
      await rename(oldPath, newPath);
      return true;
    } catch (error) {
      console.error("[gooseFs/tauri] rename failed:", error);
      return false;
    }
  },

  selectDirectory: async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: "选择 Markdown 文件夹",
      });

      if (typeof selected === "string" && selected.trim().length > 0) {
        localStorage.setItem(LAST_SELECTED_DIRECTORY_KEY, selected);
        return selected;
      }
      return null;
    } catch (error) {
      console.error("[gooseFs/tauri] selectDirectory failed:", error);
      throw error;
    }
  },

  restoreLastDirectory: async () => {
    const lastPath = localStorage.getItem(LAST_SELECTED_DIRECTORY_KEY);
    if (!lastPath) return null;

    const existsAsync = tauriGooseFs.existsAsync;
    if (!existsAsync) return null;

    const ok = await existsAsync(lastPath);
    return ok ? lastPath : null;
  },
};
