import type { SettingsTab } from "@/pages/workspace/components/sidebar/settings/types";

export function isWorkspaceSettingsOpen(root: Pick<Document, "body"> = document): boolean {
  return root.body.hasAttribute("data-goose-settings-open");
}

/** Only explicit user navigation emits this event; hydration and focus do not. */
export function activateWorkspace(host: Window = window): void {
  host.dispatchEvent(new CustomEvent("goose-note:workspace-activate"));
}

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === "string" && ["appearance", "general", "shortcuts", "local-folder", "git-sync", "ai", "data"].includes(value);
}

const SETTINGS_HOTKEYS = new Set([
  "open-settings", "open-search", "toggle-ai-panel", "toggle-sidebar", "toggle-theme",
  "new-note", "new-tab", "new-window", "unified-close", "switch-sidebar-view-by-number",
  "switch-tab-by-number", "cycle-tab", "reopen-tab", "nav-back", "nav-forward",
]);
const WORKSPACE_NAVIGATION_HOTKEYS = new Set([
  "open-search", "toggle-ai-panel", "new-note", "new-tab", "switch-sidebar-view-by-number",
  "switch-tab-by-number", "cycle-tab", "reopen-tab", "nav-back", "nav-forward",
]);

export function isHotkeyAllowedInSettings(id: string): boolean {
  return SETTINGS_HOTKEYS.has(id);
}
export function isWorkspaceNavigationHotkey(id: string): boolean {
  return WORKSPACE_NAVIGATION_HOTKEYS.has(id);
}
