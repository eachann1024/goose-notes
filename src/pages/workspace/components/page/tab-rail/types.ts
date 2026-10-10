import type { Page } from "@/types";
import type { NotebookAiLayoutMode } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";

export type TabRailVariant = "page-header" | "electron-titlebar";

export interface TabRailProps {
  variant: TabRailVariant;
  page?: Page;
  onOpenSearch: () => void;
  onBeforeActivateTab?: () => void;
  settingsOpen?: boolean;
  aiPanelOpen?: boolean;
  aiLayoutMode?: NotebookAiLayoutMode;
}
