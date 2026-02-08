import type { JSONContent } from "@tiptap/react";
export type { JSONContent };

export type SyncProvider = "local" | "jianguoyun" | "icloud";
export type FontFamily = "default" | "serif" | "mono";
export type FontSize = "default" | "small";

export interface User {
  id: string;
  name: string;
  avatar?: string;
  syncProvider: SyncProvider;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  source?: "default" | "local-folder";
  localPath?: string; // 本地文件夹路径
}

export interface Page {
  id: string;
  workspaceId: string;
  parentId?: string;
  icon?: string;
  cover?: string;
  content: JSONContent;

  // Feature flags
  isFolder?: boolean;
  isFavorite?: boolean;
  isLocked: boolean;
  isFullWidth: boolean;
  fontSize: FontSize;
  fontFamily: FontFamily;

  // Metadata
  createdAt: number;
  updatedAt: number;
  order?: number; // Custom sort order
  favoriteOrder?: number; // Favorites-only sort order
  isPinned?: boolean;
  pinnedAt?: number;
  trashedAt?: number; // Soft delete

  // Local file system (for local-folder mode)
  localFilePath?: string;

  // Linking (for future bidirectional links)
  outgoingLinks?: string[];
  incomingLinks?: string[];
}
