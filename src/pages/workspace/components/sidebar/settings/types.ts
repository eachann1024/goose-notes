import type { LucideIcon } from "lucide-react";

export type SettingsTab = "general" | "appearance" | "ai" | "data";

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}
