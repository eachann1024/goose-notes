import { SIDEBAR_FONT_SIZE_DEFAULT } from "./types";

export function migrateSettingsPersistedState(
  persistedState: unknown,
  version = 3,
): Record<string, unknown> {
  const state =
    persistedState && typeof persistedState === "object"
      ? { ...(persistedState as Record<string, unknown>) }
      : {};

  // 旧版只有「界面字号」两档，且侧栏树写死 13px。缺省时从界面档位推断侧栏字号。
  if (
    typeof state.sidebarFontSize !== "number" ||
    !Number.isFinite(state.sidebarFontSize)
  ) {
    state.sidebarFontSize =
      state.uiFontSize === "normal" || state.uiFontSize === "large" ? 15 : SIDEBAR_FONT_SIZE_DEFAULT;
  }

  // 极简工作区已成为固定交互，不再保留可切换设置。
  state.singleTabMode = true;
  if (typeof state.randomIconOnCreate !== "boolean") {
    state.randomIconOnCreate = true;
  }
  delete state.showPinnedTitles;

  // 全宽、表格两端对齐已成为常规笔记的固定布局，不再保留可切换的持久化设置。
  delete state.globalEditorFullWidth;
  delete state.tableEvenColumnWidth;

  // v4 拆分应用内与系统全局搜索；只迁移旧全局默认，保留应用内自定义和禁用状态。
  const desktop = state.desktop;
  if (desktop && typeof desktop === "object") {
    const desktopSettings = desktop as Record<string, unknown>;
    if (version < 4 && desktopSettings.searchHotkey === "CmdOrCtrl+K") {
      state.desktop = { ...desktopSettings, searchHotkey: "CmdOrCtrl+Shift+K" };
    }
  }

  return state;
}
