import {
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  LEGACY_DEFAULT_QUICKNOTE_HOTKEY,
  SIDEBAR_FONT_SIZE_DEFAULT,
  EDITOR_FONT_SIZE_DEFAULT,
  EDITOR_LINE_HEIGHT_DEFAULT,
} from "./types";

export function migrateSettingsPersistedState(
  persistedState: unknown,
  version = 3,
): Record<string, unknown> {
  const state =
    persistedState && typeof persistedState === "object"
      ? { ...(persistedState as Record<string, unknown>) }
      : {};

  delete state.codeStyle;

  // 旧版只有「界面字号」两档，且侧栏树写死 13px。缺省时从界面档位推断侧栏字号。
  if (
    typeof state.sidebarFontSize !== "number" ||
    !Number.isFinite(state.sidebarFontSize)
  ) {
    state.sidebarFontSize =
      state.uiFontSize === "normal" || state.uiFontSize === "large" ? 15 : SIDEBAR_FONT_SIZE_DEFAULT;
  }

  // ponytail: 旧设置没有“是否自定义”标记，只迁移旧默认值；以后显式记录用户覆盖。
  if (version < 6) {
    if (state.editorFontSize === 16) state.editorFontSize = EDITOR_FONT_SIZE_DEFAULT;
    if (state.editorLineHeight === 1.5) state.editorLineHeight = EDITOR_LINE_HEIGHT_DEFAULT;
    if (state.defaultPageLayout === "compact") state.defaultPageLayout = "standard";
  }

  // ponytail: 无法区分旧默认与手动选择的 1.95；仅迁移此值，未来用显式覆盖标记区分。
  if (version < 8 && state.editorLineHeight === 1.95) {
    state.editorLineHeight = EDITOR_LINE_HEIGHT_DEFAULT;
  }

  // 极简工作区已成为固定交互，不再保留可切换设置。
  state.singleTabMode = true;
  if (typeof state.randomIconOnCreate !== "boolean") {
    state.randomIconOnCreate = false;
  }
  delete state.showPinnedTitles;

  // 全宽、表格两端对齐已成为常规笔记的固定布局，不再保留可切换的持久化设置。
  delete state.globalEditorFullWidth;
  delete state.tableEvenColumnWidth;

  // v4 拆分应用内与系统全局搜索；只迁移旧全局默认，保留应用内自定义和禁用状态。
  // v5 速记小窗默认改为 Option/Alt+N；只改还停在旧默认的用户。
  const desktop = state.desktop;
  if (desktop && typeof desktop === "object") {
    const desktopSettings = { ...(desktop as Record<string, unknown>) };
    let changed = false;
    if (version < 4 && desktopSettings.searchHotkey === "CmdOrCtrl+K") {
      desktopSettings.searchHotkey = DEFAULT_SEARCH_HOTKEY;
      changed = true;
    }
    if (
      version < 5 &&
      desktopSettings.quicknoteHotkey === LEGACY_DEFAULT_QUICKNOTE_HOTKEY
    ) {
      desktopSettings.quicknoteHotkey = DEFAULT_QUICKNOTE_HOTKEY;
      changed = true;
    }
    if (changed) {
      state.desktop = desktopSettings;
    }
  }

  return state;
}
