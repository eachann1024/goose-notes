export function migrateSettingsPersistedState(
  persistedState: unknown,
): Record<string, unknown> {
  const state =
    persistedState && typeof persistedState === "object"
      ? { ...(persistedState as Record<string, unknown>) }
      : {};

  // 极简工作区已成为固定交互，不再保留可切换设置。
  state.singleTabMode = true;
  if (typeof state.randomIconOnCreate !== "boolean") {
    state.randomIconOnCreate = true;
  }
  delete state.showPinnedTitles;

  // 全宽、表格两端对齐已成为常规笔记的固定布局，不再保留可切换的持久化设置。
  delete state.globalEditorFullWidth;
  delete state.tableEvenColumnWidth;

  // 旧默认全局搜索是 Mod+Shift+K；未改过的配置迁到 Mod+K（⌘K / Ctrl+K）。
  const appShortcuts = state.appShortcuts;
  if (appShortcuts && typeof appShortcuts === "object") {
    const shortcuts = appShortcuts as Record<string, unknown>;
    if (shortcuts.openSearch === "Mod+Shift+K") {
      state.appShortcuts = { ...shortcuts, openSearch: "Mod+K" };
    }
  }
  const desktop = state.desktop;
  if (desktop && typeof desktop === "object") {
    const desktopSettings = desktop as Record<string, unknown>;
    if (desktopSettings.searchHotkey === "CmdOrCtrl+Shift+K") {
      state.desktop = { ...desktopSettings, searchHotkey: "CmdOrCtrl+K" };
    }
  }

  return state;
}
