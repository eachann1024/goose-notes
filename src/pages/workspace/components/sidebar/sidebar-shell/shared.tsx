import type { SettingsTab } from "../settings/types";

export type SidebarView = "pages" | "outline" | "search";

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  disableResize?: boolean;
  selectedPageId?: string | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  settingsOpen: boolean;
  settingsSidebarExpanded: boolean;
  onSettingsSidebarExpandedChange: (expanded: boolean) => void;
  onSettingsOpenChange: (open: boolean) => void;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  settingsMainHost: HTMLElement | null;
}
