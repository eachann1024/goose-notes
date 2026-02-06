import type { LucideIcon } from "lucide-react";

export type SettingsTab = "general" | "appearance" | "data";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}
