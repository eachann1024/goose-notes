/// <reference types="vite/client" />
export {}

interface GooseFs {
  readDir: (dir: string) => any[];
  readDirAsync?: (dir: string) => Promise<any[]>;
  readFile: (path: string) => string | null;
  readFileAsync?: (path: string) => Promise<string | null>;
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
}

declare global {
  interface Window {
    utools?: any;
    gooseFs?: GooseFs;
  }
}

