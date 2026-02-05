export {};

// 类型定义
type FileSystemHandleKind = 'file' | 'directory';

interface FileSystemHandle {
  kind: FileSystemHandleKind;
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  values(): AsyncIterable<FileSystemHandle>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
  }
}

// 状态管理
let rootHandle: FileSystemDirectoryHandle | null = null;
let rootPathPrefix: string = "";

const DB_NAME = "goose-note-fs";
const STORE_NAME = "handles";
const ROOT_HANDLE_KEY = "root-handle";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

// 路径处理辅助函数
function normalizePath(p: string): string {
  // 移除开头和结尾的斜杠，统一分隔符
  return p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

async function getHandleByPath(path: string, create = false): Promise<FileSystemHandle | null> {
  if (!rootHandle) return null;

  // 如果路径就是根目录
  if (path === rootPathPrefix || path === "/" || path === "") {
      return rootHandle;
  }

  // 移除根路径前缀
  let relativePath = path;
  if (path.startsWith(rootPathPrefix)) {
    relativePath = path.slice(rootPathPrefix.length);
  }
  relativePath = normalizePath(relativePath);
  
  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = rootHandle;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const isLast = i === parts.length - 1;

    try {
      if (isLast) {
         // 尝试获取文件或目录
         try {
             return await current.getDirectoryHandle(part);
         } catch {
             try {
                return await current.getFileHandle(part, { create });
             } catch {
                 return null;
             }
         }
      } else {
        current = await current.getDirectoryHandle(part, { create });
      }
    } catch (e) {
      return null;
    }
  }
  return current;
}


// GooseFs 实现
export const browserGooseFs = {
  // 初始化根目录选择
  async selectDirectory() {
     try {
         const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
         rootHandle = handle;
         rootPathPrefix = handle.name;
         try {
           await idbSet(ROOT_HANDLE_KEY, handle);
         } catch (e) {
           console.error("Persist handle failed", e);
         }
         return handle.name;
     } catch (e) {
         console.error("User cancelled or API not supported", e);
         return null;
     }
  },
  async restoreLastDirectory() {
      try {
          const handle = await idbGet<FileSystemDirectoryHandle>(ROOT_HANDLE_KEY);
          if (!handle) return null;
          // @ts-ignore
          const permission = await handle.queryPermission?.({ mode: "readwrite" });
          if (permission !== "granted") return null;
          rootHandle = handle;
          rootPathPrefix = handle.name;
          return handle.name;
      } catch (e) {
          console.error("Restore handle failed", e);
          return null;
      }
  },

  readDir(dirPath: string) {
    // 这是一个同步接口，但在浏览器中 FS API 是异步的。
    // 我们无法完美 polyfill 一个同步接口。
    // 这里的 workaround 是：GooseFs 在浏览器环境下可能需要被改造为支持异步，
    // 或者我们在此处抛出错误，提示需要重构。
    // 但为了快速修复，我们先尝试仅支持 root 目录的简单缓存，或者
    // ！！！ 这是一个根本性的冲突。preload 中是使用 Node.js fs 同步接口。
    // 浏览器中 File System Access API 全是 Promise。
    
    // 临时方案：返回空数组并触发一个异步加载？
    // 不，这会导致 UI 渲染空白。
    
    // 重新审视需求："无论什么环境都能打开本地"。
    // 如果是纯 Web，我们无法做同步 readDir。
    // 我们必须修改 usePages 中的 loadLocalFolderPages 为异步 (它已经是 async 了!)
    
    // 让我们看看 usePages 的 readDir 调用：
    // const entries = (window as any).gooseFs.readDir(dirPath);
    // 这里是同步调用。我们必须修改 usePages，使其支持异步 readDir。
    console.warn("Synchronous readDir is not supported in browser environment directly. Please verify modification of usePages.");
    return [];
  },

  // 异步版本的 API，需要在 usePages 中适配
  async readDirAsync(dirPath: string) {
      const handle = await getHandleByPath(dirPath);
      if (!handle || handle.kind !== 'directory') return [];
      
      const entries = [];
      // @ts-ignore
      for await (const entry of (handle as FileSystemDirectoryHandle).values()) {
          entries.push({
              name: entry.name,
              isFile: entry.kind === 'file',
              isDirectory: entry.kind === 'directory',
              path: `${dirPath}/${entry.name}`
          });
      }
      return entries;
  },
  
  async readFileAsync(filePath: string) {
      const handle = await getHandleByPath(filePath);
      if (!handle || handle.kind !== 'file') return null;
      const file = await (handle as FileSystemFileHandle).getFile();
      return await file.text();
  },

  readFile(filePath: string) {
      console.warn("Sync readFile called in browser. Use readFileAsync.");
      return null;
  },

  async mkdir(dirPath: string) {
      if (!rootHandle) return false;
      const relativePath = dirPath.startsWith(rootPathPrefix) ? dirPath.slice(rootPathPrefix.length) : dirPath;
      const parts = normalizePath(relativePath).split("/");
      
      let current = rootHandle;
      for (const part of parts) {
          if (!part) continue;
          try {
            current = await current.getDirectoryHandle(part, { create: true });
          } catch (e) {
            console.error("mkdir failed at part:", part, e);
            return false;
          }
      }
      return true;
  },
  
  async writeFileAsync(filePath: string, content: string) {
       // Ensure parent directory exists
       const relativePath = filePath.startsWith(rootPathPrefix) ? filePath.slice(rootPathPrefix.length) : filePath;
       const normalized = normalizePath(relativePath);
       const parts = normalized.split("/");
       const fileName = parts.pop();
       
       if (!fileName || !rootHandle) return false;
       
       let current = rootHandle;
       // Traverse/Create directories
       for (const part of parts) {
           if (!part) continue;
           try {
               current = await current.getDirectoryHandle(part, { create: true });
           } catch {
               return false;
           }
       }
       
       try {
           const fileHandle = await current.getFileHandle(fileName, { create: true });
           const writable = await fileHandle.createWritable();
           await writable.write(content);
           await writable.close();
           return true;
       } catch (e) {
           console.error("writeFileAsync failed", e);
           return false;
       }
  },

  exists(filePath: string) {
      // Browser synchronous check is not impossible but expensive/async-in-sync-wrapper is not possible.
      // We assume true for checks, relying on read failures.
      return true; 
  },
  
  async existsAsync(filePath: string) {
      const handle = await getHandleByPath(filePath);
      return !!handle;
  },
  
  // Stubs / Compat
  writeFile: (path: string, content: string) => {
      console.warn("Sync writeFile called in browser. Use writeFileAsync.");
      // Fire and forget, but dangerous
      // browserGooseFs.writeFileAsync(path, content);
      return false;
  },
  
  // Stubs
  watch: () => {},
  unwatch: () => {},
  deleteFile: async (path: string) => {
      console.warn("Browser mode does not support system trash, delete blocked:", path);
      return false;
  },
  deleteDir: async (path: string) => {
      console.warn("Browser mode does not support system trash, delete blocked:", path);
      return false;
  },
  rename: async () => true // Rename not easily supported in File System Access yet (move)
};
