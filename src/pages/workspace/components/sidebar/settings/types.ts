import type { LucideIcon } from "lucide-react";

export type SettingsTab =
  | "appearance"
  | "general"
  | "shortcuts"
  | "local-folder"
  | "ai"
  | "data"
  | "about";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}
