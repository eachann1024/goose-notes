import type { Page, Workspace } from "@/types";

export type StorageMode =
  | "markdown-only"
  | "hybrid"
  | "database-only";

export interface StorageSettings {
  mode: StorageMode;
  workspacePath: string;
  autoSync: boolean;
  backupEnabled: boolean;
  backupInterval: number;
  frontmatterEnabled: boolean;
  indexEnabled: boolean;
  searchIndexEnabled: boolean;
}

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  mode: "hybrid",
  workspacePath: "",
  autoSync: true,
  backupEnabled: true,
  backupInterval: 24,
  frontmatterEnabled: true,
  indexEnabled: true,
  searchIndexEnabled: true,
};

export interface SearchResult {
  pageId: string;
  title: string;
  preview: string;
  score?: number;
}

export interface PageMeta {
  id: string;
  workspaceId: string;
  parentId?: string;
  title: string;
  icon?: string;
  isFolder: boolean;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  filePath?: string;
}

export interface StorageAdapter {
  readonly mode: StorageMode;
  readonly isReady: boolean;

  getPage(id: string): Promise<Page | null>;
  savePage(page: Page): Promise<void>;
  deletePage(id: string): Promise<void>;
  listPages(workspaceId?: string): Promise<PageMeta[]>;

  searchPages(query: string): Promise<SearchResult[]>;

  saveAttachment(pageId: string, file: File): Promise<string>;
  getAttachment(path: string): Promise<Uint8Array | null>;

  sync(): Promise<void>;

  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface FileChange {
  type: "create" | "modify" | "delete";
  path: string;
}

export interface SyncTask {
  type: "save" | "delete" | "index";
  pageId: string;
  data?: unknown;
}
