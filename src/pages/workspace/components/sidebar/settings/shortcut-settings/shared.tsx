export {
  isElectronHost,
  type SettingsShortcutsProps,
  SETTINGS_OPTION_ROW_CLASS,
  FIXED_APP_SHORTCUTS,
  TAB_ONLY_APP_SHORTCUT_IDS,
  ALWAYS_FIXED_SHORTCUT_VALUES,
  TAB_ONLY_FIXED_SHORTCUT_VALUES,
  FIXED_SHORTCUT_VALUES,
  FIXED_SHORTCUTS,
  FIXED_SHORTCUT_PLATFORMS,
} from "./sections/shortcutConfig";

export {
  getAllConfiguredShortcuts,
  makeAppShortcutSetter,
} from "./sections/shortcutConflict";

export { KbdShortcut, FixedShortcutRow } from "./sections/ShortcutDisplay";

export {
  desktopHotkeyStatusText,
  DesktopGlobalHotkeysCard,
} from "./sections/DesktopGlobalHotkeysCard";
