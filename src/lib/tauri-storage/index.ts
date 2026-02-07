// 类型定义
export type { StorageAdapter, StorageSettings, StorageMode } from "./types";
export type { SearchResult, PageMeta, FileChange, SyncTask } from "./types";

// 常量
export const STORAGE_MODE_LABELS = {
  "markdown-only": "纯 Markdown 模式",
  "hybrid": "双写模式（推荐）",
  "database-only": "数据库存储",
} as const;

export const STORAGE_MODE_DESCRIPTIONS = {
  "markdown-only": "所有笔记以标准 Markdown 文件保存，可用任何编辑器打开",
  "hybrid": "Markdown 文件 + SQLite 索引，兼顾兼容性和性能",
  "database-only": "仅使用数据库存储（传统模式）",
} as const;

// 工具函数
export * from "./utils";

// 适配器
export { MarkdownStorageAdapter } from "./adapters/markdown-adapter";
export { SQLiteAdapter } from "./adapters/sqlite-adapter";
export { HybridStorageAdapter } from "./adapters/hybrid-adapter";

import type { StorageAdapter, StorageSettings } from "./types";
import { MarkdownStorageAdapter } from "./adapters/markdown-adapter";
import { HybridStorageAdapter } from "./adapters/hybrid-adapter";

let currentAdapter: StorageAdapter | null = null;

export function createStorageAdapter(settings: StorageSettings): StorageAdapter {
  switch (settings.mode) {
    case "markdown-only":
      return new MarkdownStorageAdapter(settings);
    case "hybrid":
      return new HybridStorageAdapter(settings);
    default:
      throw new Error(`Unknown storage mode: ${settings.mode}`);
  }
}

export async function initializeStorage(settings: StorageSettings): Promise<StorageAdapter> {
  if (currentAdapter) {
    await currentAdapter.close();
  }

  currentAdapter = createStorageAdapter(settings);
  await currentAdapter.initialize();

  return currentAdapter;
}

export function getCurrentAdapter(): StorageAdapter | null {
  return currentAdapter;
}

export async function closeStorage(): Promise<void> {
  if (currentAdapter) {
    await currentAdapter.close();
    currentAdapter = null;
  }
}
