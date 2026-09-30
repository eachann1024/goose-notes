import type { GooseIcon } from "@/components/ui/icons";

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
  icon: GooseIcon;
}
