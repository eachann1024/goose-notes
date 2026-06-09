// preload 运行在 CJS，避免与主项目 ESM 冲突
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL: NodeURL } = require("url");
const {
  buildLocalPageId,
  createSnippet,
  extractMarkdownTitle,
  extractTextFromPageContent,
  extractTitleFromPageContent,
  parsePersistedNotebooks,
  searchNoteItems,
  sortNoteItems,
  stripMarkdownSyntax,
} = require("./mcp-tools.cjs");

if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;
  const PENDING_OPEN_FOLDER_KEY = "__gooseNotePendingOpenFolder";
  const SETTINGS_STORAGE_KEY = "goose-note-settings";
  const NOTEBOOK_STORAGE_KEY = "goose-note-notebooks";
  const INTERNAL_PAGE_DOC_PREFIX = "gn:page:";
  const STORAGE_FALLBACK_DOC_PREFIX = "gn:storage:";
  const UTOOLS_WINDOW_HEIGHT_MIN = 600;
  const UTOOLS_WINDOW_HEIGHT_MAX = 1200;
  const LOCAL_NOTE_SCAN_CACHE_TTL_MS = 3000;
  const LOCAL_IGNORED_FOLDERS = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vscode",
    ".idea",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
  ]);
  const localNotebookScanCache = new Map();

  const clampWindowHeight = (height) => {
    const normalized = Number(height);
    if (!Number.isFinite(normalized)) return UTOOLS_WINDOW_HEIGHT_MIN;
    return Math.min(
      UTOOLS_WINDOW_HEIGHT_MAX,
      Math.max(UTOOLS_WINDOW_HEIGHT_MIN, Math.round(normalized)),
    );
  };

  const readStoredString = (storageKey) => {
    try {
      if (typeof utools?.dbStorage?.getItem === "function") {
        const value = utools.dbStorage.getItem(storageKey);
        if (typeof value === "string") return value;
      }
    } catch (error) {
      console.error("[goose-note] read dbStorage failed:", error);
    }

    try {
      if (utools?.db?.get) {
        const fallbackDoc = utools.db.get(`${STORAGE_FALLBACK_DOC_PREFIX}${storageKey}`);
        if (typeof fallbackDoc?.data === "string") return fallbackDoc.data;
        if (typeof fallbackDoc?.data?.value === "string") return fallbackDoc.data.value;
      }
    } catch (error) {
      console.error("[goose-note] read fallback storage failed:", error);
    }

    return null;
  };

  const writeStoredString = (storageKey, value) => {
    try {
      if (typeof utools?.dbStorage?.setItem === "function") {
        utools.dbStorage.setItem(storageKey, value);
        return;
      }
    } catch (error) {
      console.error("[goose-note] write dbStorage failed:", error);
    }

    try {
      if (utools?.db?.put && utools?.db?.get) {
        const docId = `${STORAGE_FALLBACK_DOC_PREFIX}${storageKey}`;
        const current = utools.db.get(docId);
        utools.db.put({
          _id: docId,
          _rev: current?._rev,
          data: {
            value,
            updatedAt: Date.now(),
          },
        });
      }
    } catch (error) {
      console.error("[goose-note] write fallback storage failed:", error);
    }
  };

  const readStoredSettingsWindowHeight = () => {
    const parseWindowHeight = (rawValue) => {
      if (typeof rawValue !== "string" || !rawValue) return null;
      try {
        const parsed = JSON.parse(rawValue);
        return clampWindowHeight(parsed?.state?.utools?.windowHeight);
      } catch (error) {
        console.error("[goose-note] parse persisted settings failed:", error);
        return null;
      }
    };

    const storedValue = readStoredString(SETTINGS_STORAGE_KEY);
    const parsedHeight = parseWindowHeight(storedValue);
    if (parsedHeight !== null) return parsedHeight;

    return null;
  };

  const applyStoredWindowHeightBeforeRender = () => {
    try {
      const storedHeight = readStoredSettingsWindowHeight();
      const initialHeight = storedHeight ?? UTOOLS_WINDOW_HEIGHT_MIN;
      if (typeof utools?.setExpendHeight === "function") {
        utools.setExpendHeight(initialHeight);
      }
    } catch (error) {
      console.error("[goose-note] apply initial window height failed:", error);
    }
  };

  applyStoredWindowHeightBeforeRender();

  const invalidateLocalNotebookCache = () => {
    localNotebookScanCache.clear();
  };

  const clampLimit = (value, fallback) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.min(500, Math.max(1, Math.floor(normalized)));
  };

  const clampOffset = (value, fallback = 0) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.max(0, Math.floor(normalized));
  };

  const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  };

  const listPersistedNotebooks = () => {
    const notebooks = parsePersistedNotebooks(readStoredString(NOTEBOOK_STORAGE_KEY));
    return notebooks.length > 0
      ? notebooks
      : [
          {
            id: "default-notebook",
            name: "Note",
            source: "default",
          },
        ];
  };

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

    return false;
  };

  const resolveWriteEncoding = (encoding) =>
    encoding === "base64" || encoding === "binary" ? "base64" : "utf-8";

  const resolveTempTargetPath = (relativePath) => {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      throw new Error("relativePath is required");
    }

    const normalized = path
      .normalize(relativePath)
      .replace(/^(\.\.(\/|\\|$))+/, "")
      .replace(/^[/\\]+/, "");
    const targetPath = path.join(os.tmpdir(), normalized);

    if (!targetPath.startsWith(os.tmpdir())) {
      throw new Error("invalid temp path");
    }

    return targetPath;
  };

  const getBase64ByteLength = (contentBase64) => {
    const sanitized = String(contentBase64 || "").replace(/\s+/g, "");
    if (!sanitized) return 0;
    const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
    return Math.floor((sanitized.length * 3) / 4) - padding;
  };

  const removeExpiredEntries = async (targetPath, cutoff) => {
    let stat;
    try {
      stat = await fs.promises.stat(targetPath);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      let children = [];
      try {
        children = await fs.promises.readdir(targetPath);
      } catch {
        return;
      }

      await Promise.all(
        children.map((child) => removeExpiredEntries(path.join(targetPath, child), cutoff)),
      );

      try {
        const remaining = await fs.promises.readdir(targetPath);
        if (remaining.length === 0) {
          await fs.promises.rmdir(targetPath);
        }
      } catch {}
      return;
    }

    if (stat.mtimeMs >= cutoff) return;

    try {
      await fs.promises.unlink(targetPath);
    } catch (err) {
      console.error("[gooseFs] cleanup temp file failed:", err);
    }
  };

  const revealItemInFolder = (targetPath) => {
    try {
      if (typeof utools?.shellShowItemInFolder === "function") {
        return !!utools.shellShowItemInFolder(targetPath);
      }
    } catch (err) {
      console.error("[gooseFs] utools shellShowItemInFolder failed:", err);
    }

    try {
      if (typeof utools?.shellOpenPath === "function") {
        return !!utools.shellOpenPath(path.dirname(targetPath));
      }
    } catch (err) {
      console.error("[gooseFs] utools shellOpenPath failed:", err);
    }

    return false;
  };

  const getNotebookAvailability = (notebook) => {
    if (notebook?.source !== "local-folder") return "ready";
    if (!notebook.localPath) return "path_missing";
    if (!fs.existsSync(notebook.localPath)) return "path_missing";
    try {
      fs.accessSync(notebook.localPath, fs.constants.R_OK);
      return "ready";
    } catch {
      return "unreadable";
    }
  };

  const buildNotebookSummary = (notebook, options = {}) => {
    const includeLocalPaths = options.includeLocalPaths === true;
    const summary = {
      id: notebook.id,
      name: notebook.name,
      source: notebook.source === "local-folder" ? "local-folder" : "default",
      availability: getNotebookAvailability(notebook),
    };

    if (
      includeLocalPaths &&
      notebook.source === "local-folder" &&
      typeof notebook.localPath === "string"
    ) {
      summary.localPath = notebook.localPath;
    }

    return summary;
  };

  const createInternalNoteRecord = (page, notebooksMap) => {
    const notebook = notebooksMap.get(page.workspaceId);
    const title = extractTitleFromPageContent(page.content);
    const contentText = extractTextFromPageContent(page.content);
    return {
      id: page.id,
      title,
      notebookId: page.workspaceId,
      notebookName: notebook?.name || "未知记事本",
      sourceType: "app-page",
      parentId: typeof page.parentId === "string" ? page.parentId : undefined,
      createdAt: Number(page.createdAt || 0),
      updatedAt: Number(page.updatedAt || 0),
      isFolder: page.isFolder === true,
      trashedAt: typeof page.trashedAt === "number" ? page.trashedAt : undefined,
      snippet: createSnippet(contentText),
      contentText,
      rawContentFormat: "blocknote_json",
      rawContent: page.content,
    };
  };

  const listInternalNotes = (notebooksMap) => {
    if (typeof utools?.db?.allDocs !== "function") return [];

    try {
      return utools.db
        .allDocs(INTERNAL_PAGE_DOC_PREFIX)
        .map((doc) => doc?.data)
        .filter((page) => page && typeof page.id === "string")
        .map((page) => createInternalNoteRecord(page, notebooksMap));
    } catch (error) {
      console.error("[goose-note] list internal notes failed:", error);
      return [];
    }
  };

  const shouldIgnoreLocalEntry = (name) =>
    typeof name === "string" &&
    (name.startsWith(".") || LOCAL_IGNORED_FOLDERS.has(name));

  const scanLocalNotebookNotes = async (notebook) => {
    const cacheKey = notebook.id;
    const cached = localNotebookScanCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const availability = getNotebookAvailability(notebook);
    if (availability !== "ready") {
      const result = { availability, items: [] };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    }

    const scanDirectory = async (dirPath, parentId) => {
      let entries;
      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        throw error;
      }

      const sortedEntries = [...entries].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-CN", { numeric: true }),
      );
      const items = [];

      for (const entry of sortedEntries) {
        if (shouldIgnoreLocalEntry(entry.name)) continue;
        const entryPath = path.join(dirPath, entry.name);

        let stats;
        try {
          stats = await fs.promises.stat(entryPath);
        } catch {
          continue;
        }

        if (entry.isDirectory()) {
          const folderId = buildLocalPageId(notebook.id, notebook.localPath, entryPath);
          items.push({
            id: folderId,
            title: entry.name,
            notebookId: notebook.id,
            notebookName: notebook.name,
            sourceType: "local-file",
            parentId,
            createdAt: Number(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs || now),
            updatedAt: Number(stats.mtimeMs || now),
            isFolder: true,
            localFilePath: entryPath,
            snippet: "",
            contentText: "",
            rawContentFormat: "markdown",
            rawContent: "",
          });
          const childItems = await scanDirectory(entryPath, folderId);
          items.push(...childItems);
          continue;
        }

        if (!entry.isFile() || !/\.(md|markdown)$/i.test(entry.name)) continue;

        let markdown = "";
        try {
          markdown = await fs.promises.readFile(entryPath, "utf-8");
        } catch {
          continue;
        }

        const fallbackTitle = entry.name.replace(/\.(md|markdown)$/i, "").trim() || "无标题";
        const contentText = stripMarkdownSyntax(markdown);
        items.push({
          id: buildLocalPageId(notebook.id, notebook.localPath, entryPath),
          title: extractMarkdownTitle(markdown, fallbackTitle),
          notebookId: notebook.id,
          notebookName: notebook.name,
          sourceType: "local-file",
          parentId,
          createdAt: Number(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs || now),
          updatedAt: Number(stats.mtimeMs || now),
          isFolder: false,
          localFilePath: entryPath,
          snippet: createSnippet(contentText),
          contentText,
          rawContentFormat: "markdown",
          rawContent: markdown,
        });
      }

      return items;
    };

    try {
      const items = await scanDirectory(notebook.localPath, undefined);
      const result = { availability: "ready", items };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (error) {
      console.error("[goose-note] scan local notebook failed:", error);
      const result = { availability: "unreadable", items: [] };
      localNotebookScanCache.set(cacheKey, {
        expiresAt: now + LOCAL_NOTE_SCAN_CACHE_TTL_MS,
        value: result,
      });
      return result;
    }
  };

  const listAllNotes = async () => {
    const notebooks = listPersistedNotebooks();
    const notebooksMap = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
    const internalNotes = listInternalNotes(notebooksMap);
    const localNotebooks = notebooks.filter((notebook) => notebook.source === "local-folder");
    const localResults = await Promise.all(localNotebooks.map(scanLocalNotebookNotes));
    const localNotes = localResults.flatMap((result) => result.items);

    return {
      notebooks,
      notebookSummaries: notebooks.map((notebook) => buildNotebookSummary(notebook)),
      notes: [...internalNotes, ...localNotes],
    };
  };

  const filterNotes = (notes, params = {}) => {
    const notebookIds = normalizeStringArray(params.notebook_ids);
    const sourceTypes = normalizeStringArray(params.source_types);
    const includeTrashed = params.include_trashed === true;
    const includeFolders = params.include_folders === true;

    return notes.filter((note) => {
      if (notebookIds.length > 0 && !notebookIds.includes(note.notebookId)) return false;
      if (sourceTypes.length > 0 && !sourceTypes.includes(note.sourceType)) return false;
      if (!includeTrashed && typeof note.trashedAt === "number") return false;
      if (!includeFolders && note.isFolder) return false;
      return true;
    });
  };

  const paginateItems = (items, params = {}, fallbackLimit = 100) => {
    const offset = clampOffset(params.offset, 0);
    const limit = clampLimit(params.limit, fallbackLimit);
    return {
      total: items.length,
      items: items.slice(offset, offset + limit),
    };
  };

  const buildListItem = (note) => {
    const item = {
      id: note.id,
      title: note.title,
      notebookId: note.notebookId,
      notebookName: note.notebookName,
      sourceType: note.sourceType,
      parentId: note.parentId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      isFolder: note.isFolder === true,
      snippet: note.snippet || "",
    };

    if (typeof note.localFilePath === "string") {
      item.localFilePath = note.localFilePath;
    }

    return item;
  };

  const buildGetNoteItem = (note) => {
    if (note.isFolder) {
      throw new Error("目录节点不支持 get_note，请改用 list_notes 查看目录结构。");
    }

    const item = {
      id: note.id,
      title: note.title,
      notebookId: note.notebookId,
      notebookName: note.notebookName,
      sourceType: note.sourceType,
      parentId: note.parentId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      contentText: note.contentText || "",
      rawContentFormat: note.rawContentFormat,
      rawContent: note.rawContent,
    };

    if (typeof note.trashedAt === "number") {
      item.trashedAt = note.trashedAt;
    }
    if (typeof note.localFilePath === "string") {
      item.localFilePath = note.localFilePath;
    }

    return item;
  };

  const registerMcpTools = () => {
    if (typeof utools?.registerTool !== "function") return;

    utools.registerTool("list_notebooks", async (params = {}) => {
      const notebooks = listPersistedNotebooks();
      const items = notebooks.map((notebook) =>
        buildNotebookSummary(notebook, {
          includeLocalPaths: params.include_local_paths === true,
        }),
      );

      return { items };
    });

    utools.registerTool("list_notes", async (params = {}) => {
      const { notes } = await listAllNotes();
      const filtered = filterNotes(notes, params);
      const sorted = sortNoteItems(filtered, params.sort_by || "updated_at_desc");
      const paged = paginateItems(sorted, params, 100);
      const items = paged.items.map(buildListItem);

      return {
        total: paged.total,
        items,
      };
    });

    utools.registerTool("search_notes", async (params = {}) => {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        throw new Error("query 不能为空");
      }

      const { notes } = await listAllNotes();
      const filtered = filterNotes(notes, {
        ...params,
        include_folders: false,
      });
      const searched = searchNoteItems(filtered, query);
      const paged = paginateItems(searched, params, 50);
      const items = paged.items.map((note) => ({
        ...buildListItem(note),
        score: note.score,
        matchedFields: note.matchedFields,
      }));

      return {
        total: paged.total,
        items,
      };
    });

    utools.registerTool("get_note", async (params = {}) => {
      const noteId = typeof params.note_id === "string" ? params.note_id.trim() : "";
      if (!noteId) {
        throw new Error("note_id 不能为空");
      }

      const { notebooks, notes } = await listAllNotes();
      const note = notes.find((item) => item.id === noteId);
      if (!note) {
        const localNotebook = notebooks.find(
          (item) => item.source === "local-folder" && noteId.startsWith(`local-${item.id}-`),
        );
        if (localNotebook) {
          const availability = getNotebookAvailability(localNotebook);
          if (availability !== "ready") {
            throw new Error(
              availability === "path_missing"
                ? "对应的本地记事本路径不存在"
                : "对应的本地记事本当前不可读取",
            );
          }
        }
        throw new Error("未找到对应笔记");
      }

      return buildGetNoteItem(note);
    });
  };

  // Node 端下载远程图片，绕开渲染端 CORS。用于图片导出场景。
  // 返回 data URL（带 mime），失败返回 null。
  const fetchRemoteImage = (url, timeoutMs = 8000) => {
    const MAX_BYTES = 20 * 1024 * 1024;
    const MAX_REDIRECTS = 5;

    return new Promise((resolve) => {
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const visit = (currentUrl, redirectsLeft) => {
        let parsed;
        try {
          parsed = new NodeURL(currentUrl);
        } catch {
          finish(null);
          return;
        }
        const lib = parsed.protocol === "http:" ? http : https;
        const req = lib.get(
          currentUrl,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (GooseNote)",
              Accept: "image/*,*/*;q=0.8",
            },
          },
          (res) => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
              if (redirectsLeft <= 0) {
                res.resume();
                finish(null);
                return;
              }
              let next;
              try {
                next = new NodeURL(res.headers.location, currentUrl).toString();
              } catch {
                res.resume();
                finish(null);
                return;
              }
              res.resume();
              visit(next, redirectsLeft - 1);
              return;
            }
            if (status < 200 || status >= 400) {
              res.resume();
              finish(null);
              return;
            }

            const chunks = [];
            let total = 0;
            res.on("data", (chunk) => {
              total += chunk.length;
              if (total > MAX_BYTES) {
                req.destroy();
                finish(null);
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => {
              try {
                const buf = Buffer.concat(chunks);
                const rawType = res.headers["content-type"] || "image/png";
                const mime = String(rawType).split(";")[0].trim() || "image/png";
                finish(`data:${mime};base64,${buf.toString("base64")}`);
              } catch {
                finish(null);
              }
            });
            res.on("error", () => finish(null));
          },
        );
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          finish(null);
        });
        req.on("error", () => finish(null));
      };

      visit(url, MAX_REDIRECTS);
    });
  };

  // 本地文件系统 API 桥接（仅用于本地文件夹模式）
  window.gooseFs = {
    fetchRemoteImage,
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

    readFileBase64: (filePath) => {
      try {
        return fs.readFileSync(filePath).toString("base64");
      } catch (err) {
        console.error("[gooseFs] readFileBase64 failed:", err);
        return null;
      }
    },

    writeFile: (filePath, content, encoding = "utf-8") => {
      try {
        fs.writeFileSync(filePath, content, resolveWriteEncoding(encoding));
        // 标记最近写入，防止 watch 误触发重载提示
        recentWrites.set(filePath, Date.now());
        invalidateLocalNotebookCache();
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
        invalidateLocalNotebookCache();
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
          invalidateLocalNotebookCache();
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
          invalidateLocalNotebookCache();
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
        invalidateLocalNotebookCache();
        return true;
      } catch (err) {
        console.error("[gooseFs] rename failed:", err);
        return false;
      }
    },

    writeTempFile: async (relativePath, contentBase64) => {
      try {
        const targetPath = resolveTempTargetPath(relativePath);
        const targetDir = path.dirname(targetPath);
        await fs.promises.mkdir(targetDir, { recursive: true });

        const expectedSize = getBase64ByteLength(contentBase64);
        try {
          const existingStat = await fs.promises.stat(targetPath);
          if (existingStat.isFile() && existingStat.size === expectedSize) {
            const now = new Date();
            await fs.promises.utimes(targetPath, now, now);
            return targetPath;
          }
        } catch {}

        await fs.promises.writeFile(targetPath, contentBase64, "base64");
        return targetPath;
      } catch (err) {
        console.error("[gooseFs] writeTempFile failed:", err);
        return null;
      }
    },

    cleanupTempFiles: async (prefix, maxAgeMs) => {
      try {
        const basePath = resolveTempTargetPath(prefix);
        const cutoff = Date.now() - Number(maxAgeMs || 0);
        if (!Number.isFinite(cutoff)) return;
        await removeExpiredEntries(basePath, cutoff);
      } catch (err) {
        console.error("[gooseFs] cleanupTempFiles failed:", err);
      }
    },

    revealItemInFolder,
  };

  registerMcpTools();

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

  // ── 速记小窗（独立 browser 窗口）──────────────────────────────
  // 尺寸参考 Raycast 浮动便签：紧凑竖向。集中成常量便于调。
  const QUICKNOTE_WIDTH = 480; // 首次开窗默认宽度（用户调整后由 dbStorage 记住）
  const QUICKNOTE_MIN_WIDTH = 320;
  const QUICKNOTE_HEIGHT = 350; // 首次开窗默认高度（用户调整后由 dbStorage 记住）
  const QUICKNOTE_MIN_HEIGHT = 300;
  const QUICKNOTE_EDGE_GAP = 16; // 右上角开窗时距屏幕上/右边缘的空隙
  let quickNoteWin = null;
  let quickNotePinned = false;

  // 从 uTools db 读速记持久化偏好（zustand persist 存的 JSON）。preload 是 CJS，
  // 拿不到 React store，直接读 dbStorage 同一 key。失败回退默认值，不抛错。
  const readQuickNotePrefs = () => {
    const fallback = {
      windowWidth: QUICKNOTE_WIDTH,
      windowHeight: QUICKNOTE_HEIGHT,
      pinned: false,
    };
    try {
      const raw =
        utools.dbStorage && typeof utools.dbStorage.getItem === "function"
          ? utools.dbStorage.getItem("goose-note:quicknote")
          : null;
      if (typeof raw !== "string") return fallback;
      const parsed = JSON.parse(raw);
      const st = parsed && parsed.state ? parsed.state : parsed;
      const w = Number(st && st.windowWidth);
      const h = Number(st && st.windowHeight);
      return {
        windowWidth:
          Number.isFinite(w) && w >= QUICKNOTE_MIN_WIDTH ? Math.round(w) : QUICKNOTE_WIDTH,
        windowHeight:
          Number.isFinite(h) && h >= QUICKNOTE_MIN_HEIGHT ? Math.round(h) : QUICKNOTE_HEIGHT,
        pinned: !!(st && st.pinned),
      };
    } catch (e) {
      console.error("[quicknote] 读持久化偏好失败:", e);
      return fallback;
    }
  };

  // 接收速记小窗（子窗）通过 utools.sendToParent 发回的窗口控制请求。
  // createBrowserWindow 返回的 win 不含实例事件，故 blur 失焦在子窗内处理，
  // 这里只负责执行子窗请求的 pin / close / hide。
  // 仅主窗口需要（它持有 quickNoteWin）；小窗自身不接收这些。
  const isMainWindow =
    typeof utools.getWindowType !== "function" ||
    utools.getWindowType() === "main";

  // 速记小窗（browser 窗口）侧：把父窗 webContents.send 的复用信号转成 DOM 事件，
  // 让渲染层（QuickNoteApp）按新模式重解析。
  if (!isMainWindow) {
    try {
      const { ipcRenderer } = require("electron");
      ipcRenderer.on("quicknote:enter", (_e, data) => {
        window.dispatchEvent(
          new CustomEvent("goose-note:quicknote-enter", { detail: data || {} }),
        );
      });
      // 主窗改了笔记：转 DOM 事件，小窗据此从 db 重读（反向同步）。
      ipcRenderer.on("quicknote:note-updated-from-main", (_e, pageId) => {
        window.dispatchEvent(
          new CustomEvent("goose-note:note-updated-external", {
            detail: { pageId },
          }),
        );
      });
    } catch (err) {
      console.error("[quicknote] 子窗 ipcRenderer 不可用:", err);
    }
  }

  if (isMainWindow) try {
    const { ipcRenderer } = require("electron");
    ipcRenderer.on("quicknote:pin", (_e, pinned) => {
      quickNotePinned = !!pinned;
      if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
        try {
          quickNoteWin.setAlwaysOnTop(quickNotePinned, "floating");
        } catch {
          try { quickNoteWin.setAlwaysOnTop(quickNotePinned); } catch { /* noop */ }
        }
      }
    });
    ipcRenderer.on("quicknote:close", () => {
      if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
        try { quickNoteWin.close(); } catch { /* noop */ }
      }
      quickNoteWin = null;
    });
    ipcRenderer.on("quicknote:hide", () => {
      // 钉住时忽略失焦隐藏请求。
      if (quickNotePinned) return;
      if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
        try { quickNoteWin.hide(); } catch { /* noop */ }
      }
    });
    // 自动调整高度：子窗按内容算出目标高度，请求父窗 setSize（宽度保持不变）。
    ipcRenderer.on("quicknote:set-height", (_e, height) => {
      if (!quickNoteWin || quickNoteWin.isDestroyed?.()) return;
      const h = Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(Number(height) || 0));
      try {
        const [w] = quickNoteWin.getSize?.() || [QUICKNOTE_WIDTH];
        quickNoteWin.setSize(w || QUICKNOTE_WIDTH, h, false);
      } catch { /* noop */ }
    });
    // 用户拖动边框停下后：用 win.getSize() 读真实窗口尺寸，写回 dbStorage 的速记偏好
    // （zustand persist 的同一 key），保留其它字段。下次开窗用记住的宽高，不再被重置回默认。
    // win 不含 resize 实例事件，故由子窗 resize settle 后主动触发本通道；尺寸以主窗权威读取为准。
    ipcRenderer.on("quicknote:persist-size", () => {
      if (!quickNoteWin || quickNoteWin.isDestroyed?.()) return;
      let size;
      try {
        size = quickNoteWin.getSize?.();
      } catch { /* noop */ }
      if (!Array.isArray(size) || size.length < 2) return;
      const w = Math.max(QUICKNOTE_MIN_WIDTH, Math.round(Number(size[0]) || 0));
      const h = Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(Number(size[1]) || 0));
      try {
        const KEY = "goose-note:quicknote";
        const raw =
          utools.dbStorage && typeof utools.dbStorage.getItem === "function"
            ? utools.dbStorage.getItem(KEY)
            : null;
        let parsed = {};
        if (typeof raw === "string") {
          try { parsed = JSON.parse(raw) || {}; } catch { parsed = {}; }
        }
        // zustand persist 形如 { state: {...}, version: n }；无则就地补出 state 容器。
        const hasStateWrapper = parsed && typeof parsed.state === "object" && parsed.state;
        const state = hasStateWrapper ? parsed.state : parsed;
        state.windowWidth = w;
        state.windowHeight = h;
        const next = hasStateWrapper
          ? { ...parsed, state }
          : { state, version: 0 };
        if (utools.dbStorage && typeof utools.dbStorage.setItem === "function") {
          utools.dbStorage.setItem(KEY, JSON.stringify(next));
        }
      } catch (e) {
        console.error("[quicknote] persist-size 写偏好失败:", e);
      }
    });

    // 小窗改动某条笔记：转 DOM 事件，主窗渲染层据此从 db 重读该页，防跨窗脏写。
    ipcRenderer.on("quicknote:note-updated", (_e, pageId) => {
      window.dispatchEvent(
        new CustomEvent("goose-note:note-updated-external", {
          detail: { pageId },
        }),
      );
    });

    // 反向同步：主窗渲染层改了笔记后调此，把变更推给小窗，让小窗从 db 重读。
    window.gooseQuickNote = {
      pushNoteUpdate(pageId) {
        if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
          try {
            quickNoteWin.webContents?.send?.("quicknote:note-updated-from-main", pageId);
          } catch { /* noop */ }
        }
      },
    };
  } catch (err) {
    console.error("[quicknote] ipcRenderer 不可用:", err);
  }

  // 打开/复用速记小窗。mode: 'new' 新建空白 | 'last' 直达上次。
  const openQuickNoteWindow = (mode) => {
    // 复用：窗口已存在则更新模式后显示聚焦（reload 由渲染层按 quicknote:enter 重解析）。
    if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
      try {
        quickNoteWin.show();
        quickNoteWin.focus?.();
        quickNoteWin.webContents?.send?.("quicknote:enter", { mode });
      } catch { /* noop */ }
      return;
    }

    // 读持久化偏好：用记住的宽高开窗，并同步置顶态（读到再开，不开后再调）。
    const prefs = readQuickNotePrefs();
    quickNotePinned = prefs.pinned;
    const openWidth = prefs.windowWidth;
    const openHeight = prefs.windowHeight;

    // 定位到光标所在显示器的右上角。优先用 workArea（已扣除 macOS 菜单栏 / Dock），
    // 没有则回退 bounds，避免窗口被顶到菜单栏下面。
    let area = null;
    try {
      const point = utools.getCursorScreenPoint();
      const display = utools.getDisplayNearestPoint(point);
      area = display ? display.workArea || display.bounds : null;
    } catch { /* noop */ }
    const winOpts = {
      show: false,
      width: openWidth,
      height: openHeight,
      minWidth: QUICKNOTE_MIN_WIDTH,
      minHeight: QUICKNOTE_MIN_HEIGHT,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      closable: true, // Electron 真实字段是 closable（uTools 文档把它写成 closeable 是笔误）
      alwaysOnTop: quickNotePinned,
      roundedCorners: true,
      webPreferences: {
        preload: "preload.js",
      },
    };
    if (area) {
      // 右上角：贴右边缘留 GAP，贴上边缘留 GAP（用记住的宽度算 x，确保贴边一致）。
      winOpts.x = Math.round(area.x + area.width - openWidth - QUICKNOTE_EDGE_GAP);
      winOpts.y = Math.round(area.y + QUICKNOTE_EDGE_GAP);
    }

    // 草稿便签：两条速记指令都开同一草稿，不再按 mode 区分笔记，故 url 不带 mode。
    // url 相对「插件根目录」，dev 加载 dist 目录时根即 dist，故直接写 quicknote.html。
    const url = `quicknote.html`;
    console.log("[quicknote] createBrowserWindow url =", url);
    try {
      quickNoteWin = utools.createBrowserWindow(url, winOpts, () => {
        try {
          quickNoteWin.show();
          quickNoteWin.focus?.();
          if (quickNotePinned) {
            try { quickNoteWin.setAlwaysOnTop(true, "screen-saver"); } catch { /* noop */ }
          }
          console.log("[quicknote] 子窗已 show, url =", quickNoteWin?.webContents?.getURL?.());
        } catch (e) {
          console.error("[quicknote] 子窗 show 失败:", e);
        }
      });
      console.log("[quicknote] createBrowserWindow 返回, win =", typeof quickNoteWin, quickNoteWin == null ? "(null!)" : "(ok)");
    } catch (e) {
      console.error("[quicknote] createBrowserWindow 抛错:", e);
    }
  };

  // 速记指令处理：插件配了顶层 main，无法用 window.exports 的 mode:"none"（main 与模板模式互斥），
  // 所以走 onPluginEnter——主界面会被 uTools 先拉起，我们立刻开独立浮窗并 hideMainWindow 把主界面藏掉。
  // 不调 outPlugin（它会隐藏/卸载宿主进程，连带销毁刚建的浮窗 → 闪退，这是之前的根因）。
  utools.onPluginEnter(({ code, type, payload, optional }) => {
    const winType =
      typeof utools.getWindowType === "function" ? utools.getWindowType() : "main";
    console.log("[quicknote] onPluginEnter code =", code, "windowType =", winType);

    if (code === "quicknote_new" || code === "quicknote_last") {
      // 仅主窗处理；子窗(browser)加载 quicknote.html 时也会跑这份 preload 并收到 enter，必须守卫避免套娃。
      if (winType !== "main") {
        console.log("[quicknote] 非主窗收到速记指令，忽略");
        return;
      }
      console.log("[quicknote] 命中速记分支（主窗）");
      try {
        openQuickNoteWindow(code === "quicknote_last" ? "last" : "new");
      } catch (err) {
        console.error("[quicknote] openQuickNoteWindow 抛错:", err);
      }
      // 把主界面藏到后台（hideMainWindow 不影响独立浮窗）。延迟一拍，等浮窗 createBrowserWindow 先排上。
      setTimeout(() => {
        if (typeof utools.hideMainWindow === "function") {
          try { utools.hideMainWindow(); } catch { /* noop */ }
        }
      }, 0);
      return;
    }

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

    window.dispatchEvent(
      new CustomEvent("goose-note:plugin-enter", {
        detail: { code, type, payload, optional },
      }),
    );

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

    if (code === "new_page") {
      // over 类型：payload 通常为选中纯文本字符串；做 string/array 双兜底。
      const selectedText =
        typeof payload === "string"
          ? payload
          : (Array.isArray(payload) &&
              (payload[0]?.data || payload[0]?.text)) ||
            "";
      window.dispatchEvent(
        new CustomEvent("goose-note:new-page", {
          detail: { text: selectedText },
        }),
      );
      return;
    }
  });

  // 移出原有的全局 setSubInput，并优化同步逻辑
  const APP_SYNC_EVENT = "goose-note:utools-search-sync";
  window.__gooseNoteSuppressNextChange = false;
  window.__gooseNoteLastAppValue = "";

  if (typeof utools.onPluginOut === "function") {
    utools.onPluginOut((isKill) => {
      if (typeof utools.removeSubInput === "function") {
        utools.removeSubInput();
      }
      window.dispatchEvent(
        new CustomEvent("goose-note:plugin-out", {
          detail: {
            // isKill=true 表示插件进程被销毁，false 表示仅隐藏到后台。
            isKill: isKill === true,
          },
        }),
      );
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
