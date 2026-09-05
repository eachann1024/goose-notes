import type { LucideIcon } from "lucide-react";

export type SettingsTab =
  | "general"
  | "shortcuts"
  | "local-folder"
  | "appearance"
  | "ai"
  | "data"
  | "about";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}
