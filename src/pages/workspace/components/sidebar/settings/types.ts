import type { LucideIcon } from "lucide-react";

export type SettingsTab =
  | "appearance"
  | "general"
  | "shortcuts"
  | "local-folder"
  | "git-sync"
  | "ai"
  | "data";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}
