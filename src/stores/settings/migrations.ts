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

  return state;
}
