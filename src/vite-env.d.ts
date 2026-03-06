/// <reference types="vite/client" />
export {}

declare global {
  const __HOST_TARGET__: "utools";

  interface GooseFs {
    readDir: (dir: string) => any[];
    readDirAsync?: (dir: string) => Promise<any[]>;
    readFile: (path: string) => string | null;
    readFileAsync?: (path: string) => Promise<string | null>;
    readFileStat?: (
      path: string,
    ) => { ok: boolean; error?: string | null; content?: string | null };
    readFileStatAsync?: (
      path: string,
    ) => Promise<{ ok: boolean; error?: string | null; content?: string | null }>;
    writeFile: (path: string, content: string, encoding?: string) => boolean;
    writeFileAsync?: (path: string, content: string, encoding?: string) => Promise<boolean>;
    exists: (path: string) => boolean;
    existsAsync?: (path: string) => Promise<boolean>;
    watch: (dir: string, cb: any) => any;
    unwatch: (dir: string) => void;
    mkdir: (dir: string) => boolean | Promise<boolean>;
    deleteFile: (path: string) => boolean | Promise<boolean>;
    deleteDir: (path: string) => boolean | Promise<boolean>;
    rename: (oldPath: string, newPath: string) => boolean | Promise<boolean>;
    selectDirectory?: () => Promise<string | null>;
    restoreLastDirectory?: () => Promise<string | null>;
    revealItemInFolder?: (path: string) => boolean | Promise<boolean>;
  }

  interface Window {
    utools?: any;
    gooseFs?: GooseFs;
  }
}
