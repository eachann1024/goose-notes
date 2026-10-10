import type { ExportOptions } from "@/lib/export";

export interface NotebookOption {
  id: string;
  name: string;
  icon?: string;
}

export interface SettingsDataPanelProps {
  active: boolean;
  importing: boolean;
  onImport: () => void;
  selectedIds: string[];
  notebookList: NotebookOption[];
  onToggleNotebook: (id: string) => void;
  onSelectAll: () => void;
  format: ExportOptions["format"];
  onFormatChange: (format: ExportOptions["format"]) => void;
  exporting: boolean;
  onExport: () => void;
  onOpenResetDialog: () => void;
  onRestartGuide: () => void;
  onResetAndImport?: (blob: Blob) => Promise<void>;
}

export const DATA_BADGE_CLASS =
  "rounded-control bg-[hsl(var(--goose-selected-bg)/0.9)] px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-[hsl(var(--foreground)/0.1)]";

export const DATA_UNSELECTED_CARD_CLASS =
  "border-transparent bg-[hsl(var(--goose-selected-bg)/0.58)] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:bg-[hsl(var(--foreground)/0.08)]";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRemoteTime(value: string | null | undefined): string {
  if (!value) return "未知";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}
