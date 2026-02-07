// preload 运行在 CJS，避免与主项目 ESM 冲突
const fs = require("fs");
const path = require("path");
let electronShell = null;

try {
  const electron = require("electron");
  electronShell = electron?.shell ?? null;
} catch (err) {
  console.warn("[gooseFs] electron shell unavailable:", err);
}

if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;
  const PENDING_OPEN_FOLDER_KEY = "__gooseNotePendingOpenFolder";

  // 本地文件变更监听映射
  const watchers = new Map();
  // 最近写入的文件标记，用于避免自己写入触发重载提示
  const recentWrites = new Map();

  const tryTrash = async (targetPath) => {
    try {
      if (utools?.shellTrashItem) {
        await utools.shellTrashItem(targetPath);
        return true;
      }
    } catch (err) {
      console.error("[gooseFs] shellTrashItem failed:", err);
    }

    try {
      // Electron fallback
      const { shell } = require("electron");
      if (shell?.trashItem) {
        await shell.trashItem(targetPath);
        return true;
      }
    } catch (err) {
      console.error("[gooseFs] electron shell.trashItem failed:", err);
    }

    return false;
  };

  const resolveWriteEncoding = (encoding) =>
    encoding === "base64" || encoding === "binary" ? "base64" : "utf-8";

  const revealItemInFolder = (targetPath) => {
    try {
      if (typeof utools?.shellShowItemInFolder === "function") {
        return !!utools.shellShowItemInFolder(targetPath);
      }
    } catch (err) {
      console.error("[gooseFs] utools shellShowItemInFolder failed:", err);
    }

    try {
      if (typeof electronShell?.showItemInFolder === "function") {
        electronShell.showItemInFolder(targetPath);
        return true;
      }
    } catch (err) {
      console.error("[gooseFs] electron shell.showItemInFolder failed:", err);
    }

    try {
      if (typeof utools?.shellOpenPath === "function") {
        return !!utools.shellOpenPath(path.dirname(targetPath));
      }
    } catch (err) {
      console.error("[gooseFs] utools shellOpenPath failed:", err);
    }

    try {
      if (typeof electronShell?.openPath === "function") {
        electronShell.openPath(path.dirname(targetPath));
        return true;
      }
    } catch (err) {
      console.error("[gooseFs] electron shell.openPath failed:", err);
    }

    return false;
  };

  // 本地文件系统 API 桥接（仅用于本地文件夹模式）
  window.gooseFs = {
    readDir: (dir) => {
      try {
        return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          path: path.join(dir, entry.name),
        }));
      } catch (err) {
        console.error("[gooseFs] readDir failed:", err);
        return [];
      }
    },

    readFile: (filePath) => {
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch (err) {
        console.error("[gooseFs] readFile failed:", err);
        return null;
      }
    },

    writeFile: (filePath, content, encoding = "utf-8") => {
      try {
        fs.writeFileSync(filePath, content, resolveWriteEncoding(encoding));
        // 标记最近写入，防止 watch 误触发重载提示
        recentWrites.set(filePath, Date.now());
        return true;
      } catch (err) {
        console.error("[gooseFs] writeFile failed:", err);
        return false;
      }
    },

    writeFileAsync: async (filePath, content, encoding = "utf-8") => {
      try {
        await fs.promises.writeFile(
          filePath,
          content,
          resolveWriteEncoding(encoding),
        );
        recentWrites.set(filePath, Date.now());
        return true;
      } catch (err) {
        console.error("[gooseFs] writeFileAsync failed:", err);
        return false;
      }
    },

    exists: (filePath) => {
      try {
        return fs.existsSync(filePath);
      } catch (err) {
        console.error("[gooseFs] exists failed:", err);
        return false;
      }
    },

    watch: (dirPath, callback) => {
      try {
        // 如果已经存在监听器，先停止
        if (watchers.has(dirPath)) {
          watchers.get(dirPath).close();
        }

        const watcher = fs.watch(
          dirPath,
          { recursive: true },
          (eventType, filename) => {
            if (filename) {
              const fullPath = path.join(dirPath, filename);
              // 检查是否为最近写入的文件，避免误触发重载提示
              const now = Date.now();
              let skip = false;
              for (const [key, time] of recentWrites) {
                if (now - time >= 1000) {
                  recentWrites.delete(key);
                  continue;
                }
                if (fullPath === key || fullPath.startsWith(key)) {
                  skip = true;
                  break;
                }
              }
              if (skip) return; // 跳过自己写入/删除的文件

              // 通知前端有文件变更
              window.dispatchEvent(
                new CustomEvent("goose-note:file-changed", {
                  detail: { eventType, filename, dirPath },
                }),
              );
            }
          },
        );

        watchers.set(dirPath, watcher);
        return watcher;
      } catch (err) {
        console.error("[gooseFs] watch failed:", err);
        return null;
      }
    },

    unwatch: (dirPath) => {
      const watcher = watchers.get(dirPath);
      if (watcher) {
        watcher.close();
        watchers.delete(dirPath);
      }
    },

    mkdir: (dirPath) => {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
      } catch (err) {
        console.error("[gooseFs] mkdir failed:", err);
        return false;
      }
    },

    deleteFile: async (filePath) => {
      try {
        const ok = await tryTrash(filePath);
        if (ok) {
          recentWrites.set(filePath, Date.now());
        }
        return ok;
      } catch (err) {
        console.error("[gooseFs] deleteFile failed:", err);
        return false;
      }
    },

    deleteDir: async (dirPath) => {
      try {
        const ok = await tryTrash(dirPath);
        if (ok) {
          recentWrites.set(`${dirPath}${path.sep}`, Date.now());
        }
        return ok;
      } catch (err) {
        console.error("[gooseFs] deleteDir failed:", err);
        return false;
      }
    },

    rename: (oldPath, newPath) => {
      try {
        fs.renameSync(oldPath, newPath);
        recentWrites.set(oldPath, Date.now());
        recentWrites.set(newPath, Date.now());
        return true;
      } catch (err) {
        console.error("[gooseFs] rename failed:", err);
        return false;
      }
    },

    revealItemInFolder,
  };

  // 处理 uTools 全局搜索（sublist）点击
  // 注意：sublist API 可能不是所有 uTools 版本都支持
  if (typeof utools.onSublistEnter === "function") {
    utools.onSublistEnter((item) => {
      const pageId = item.url.replace("goose-note://page/", "");

      // 通知应用切换页面
      window.dispatchEvent(
        new CustomEvent("goose-note:navigate", {
          detail: { pageId },
        }),
      );
    });
  }

  const dispatchOpenFolder = (folderPath) => {
    window[PENDING_OPEN_FOLDER_KEY] = folderPath;
    window.dispatchEvent(
      new CustomEvent("goose-note:open-folder", {
        detail: { path: folderPath },
      }),
    );
  };

  utools.onPluginEnter(({ code, type, payload }) => {
    // 确保每次进入插件都重新设置 subInput
    if (typeof utools.setSubInput === "function") {
      const UTOOLS_INPUT_EVENT = "goose-note:utools-search";
      utools.setSubInput(
        ({ text }) => {
          // 只有当不是因为应用同步导致的变化时才派发事件
          if (window.__gooseNoteSuppressNextChange && text === window.__gooseNoteLastAppValue) {
            window.__gooseNoteSuppressNextChange = false;
            return;
          }

          window.dispatchEvent(
            new CustomEvent(UTOOLS_INPUT_EVENT, {
              detail: { text },
            }),
          );
        },
        "搜索笔记",
        true,
      );
    }

    if (code === "open_folder") {
      if ((type === "files" || type === "file") && payload && payload.length > 0) {
        const folderPath = payload[0]?.path;
        if (folderPath) {
          try {
            const stat = fs.statSync(folderPath);
            if (stat.isDirectory()) {
              dispatchOpenFolder(folderPath);
            }
          } catch (err) {
            console.error("[gooseFs] stat failed:", err);
          }
        }
      }
      return;
    }
  });

  // 移出原有的全局 setSubInput，并优化同步逻辑
  const APP_SYNC_EVENT = "goose-note:utools-search-sync";
  window.__gooseNoteSuppressNextChange = false;
  window.__gooseNoteLastAppValue = "";

  if (typeof utools.onPluginOut === "function") {
    utools.onPluginOut(() => {
      if (typeof utools.removeSubInput === "function") {
        utools.removeSubInput();
      }
      window.dispatchEvent(new CustomEvent("goose-note:plugin-out"));
    });
  }

  window.addEventListener(APP_SYNC_EVENT, (event) => {
    const detail = event.detail || {};
    const text = typeof detail.text === "string" ? detail.text : "";
    if (text === window.__gooseNoteLastAppValue) return;
    window.__gooseNoteLastAppValue = text;
    if (typeof utools.setSubInputValue === "function") {
      window.__gooseNoteSuppressNextChange = true;
      utools.setSubInputValue(text);
    }
  });
}
