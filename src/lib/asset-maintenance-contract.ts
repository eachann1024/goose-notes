import type { SettingsState } from "@/stores/settings";
import type { Page } from "@/types";
import type { UnreferencedLocalAsset } from "./local-folder-asset-maintenance";

export type AssetAppearance = Pick<SettingsState, "theme" | "accentColor" | "customFonts" | "uiFontSize" | "editorFontSize" | "editorLineHeight" | "sidebarFontSize" | "uiFontFamily" | "sidebarFontFamily">;

export type AssetNotebook = { id: string; name: string; localPath: string };
export type AssetWorkspaceSnapshot = {
  notebooks: AssetNotebook[];
  appearance: AssetAppearance;
  pages: Pick<Page, "content" | "localFilePath" | "isFolder">[];
};
export type AssetScan = {
  token: string;
  notebook: AssetNotebook;
  assets: (UnreferencedLocalAsset & { previewUrl: string })[];
};
export interface AssetMaintenanceBridge {
  open: () => Promise<void>;
  appearance: () => Promise<AssetAppearance>;
  notebooks: () => Promise<AssetNotebook[]>;
  scan: (notebookId: string) => Promise<AssetScan>;
  trash: (token: string, paths: string[]) => Promise<{ deleted: number; canceled: boolean }>;
  onSnapshotRequest: (callback: (requestId: string) => void) => () => void;
  replySnapshot: (requestId: string, snapshot: AssetWorkspaceSnapshot | null) => void;
}
