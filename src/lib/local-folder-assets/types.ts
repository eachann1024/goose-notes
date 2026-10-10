import type { Page } from "@/types";

export interface LocalFolderEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
  size?: number;
}

export interface UnreferencedLocalAsset {
  path: string;
  relativePath: string;
  name: string;
  size: number;
}

export interface RestoreMissingLocalAssetsResult {
  restored: string[];
  missing: string[];
}

export interface AssetMaintenanceFs {
  readDir: (path: string) => LocalFolderEntry[];
  readDirAsync?: (path: string) => Promise<LocalFolderEntry[]>;
  readFile: (path: string) => string | null;
  readFileAsync?: (path: string) => Promise<string | null>;
  exists: (path: string) => boolean;
  existsAsync?: (path: string) => Promise<boolean>;
  readFileBase64?: (path: string) => string | null;
  restoreFromTrash?: (path: string) => Promise<boolean>;
}

export interface ScanUnreferencedLocalAssetsOptions {
  basePath: string;
  pages: Pick<Page, "content" | "localFilePath" | "isFolder">[];
  gooseFs: AssetMaintenanceFs;
}
