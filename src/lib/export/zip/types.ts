import type { Page } from "@/types";

export interface ExportOptions {
  format: "md" | "html";
  notebookIds: string[];
}

export interface NotebookImportInspection {
  source: "metadata" | "folders";
  notebookCount: number;
  pageCount: number;
}

export type NotebookImportCallbacks = {
  onCreateNotebook: (name: string, icon?: string, id?: string) => string;
  onCreatePage: (data: Partial<Page>, workspaceId: string, parentId?: string, id?: string) => string | Promise<string>;
};
export type BundledAssetRestorer = (blocks: any[], notebookAssetMap: Map<string, string>) => void;
