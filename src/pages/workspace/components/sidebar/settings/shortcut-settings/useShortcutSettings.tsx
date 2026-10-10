import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { getPlatformKind, type PlatformKind } from "@/lib/utils";
import {
  DEFAULT_CLOSE_TAB_SHORTCUT,
  DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
  DEFAULT_WAKE_HOTKEY,
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  useSettings,
} from "@/stores/useSettings";
import {
  isElectronHost,
  type SettingsShortcutsProps,
  makeAppShortcutSetter,
} from "./shared";

export function useShortcutSettings({
  closeTabShortcut,
  setCloseTabShortcut,
  searchPanelCloseShortcut,
  setSearchPanelCloseShortcut,
  appShortcuts,
  setAppShortcut,
  resetAppShortcuts,
  singleTabMode,
}: SettingsShortcutsProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKind>(() => {
    const platform = getPlatformKind();
    return platform === "other" ? "windows" : platform;
  });

  // zustand v5 忽略第二个 equalityFn 参数，对象选择器会导致重复渲染，故拆成原始值。
  const wakeHotkey = useSettings((s) => s.desktop.wakeHotkey);

  const quicknoteHotkey = useSettings((s) => s.desktop.quicknoteHotkey);

  const searchHotkey = useSettings((s) => s.desktop.searchHotkey);

  const desktopHotkeys = isElectronHost
    ? { wakeHotkey, quicknoteHotkey, searchHotkey }
    : undefined;

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetAppShortcuts();
    setCloseTabShortcut(DEFAULT_CLOSE_TAB_SHORTCUT);
    setSearchPanelCloseShortcut(DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT);
    if (isElectronHost) {
      // 桌面全局快捷键一并恢复默认并重新启用
      const settings = useSettings.getState();
      settings.setWakeHotkey(DEFAULT_WAKE_HOTKEY);
      settings.setWakeHotkeyEnabled(true);
      settings.setQuicknoteHotkey(DEFAULT_QUICKNOTE_HOTKEY);
      settings.setQuicknoteHotkeyEnabled(true);
      settings.setSearchHotkey(DEFAULT_SEARCH_HOTKEY);
      settings.setSearchHotkeyEnabled(true);
    }
    setConfirmReset(false);
    toast.success("已恢复全部快捷键默认值");
  };

  const safeSetAppShortcut = (id: string) =>
    makeAppShortcutSetter(
      id,
      setAppShortcut,
      appShortcuts,
      closeTabShortcut,
      searchPanelCloseShortcut,
      singleTabMode,
      desktopHotkeys,
    );
  return {
    closeTabShortcut,
    setCloseTabShortcut,
    searchPanelCloseShortcut,
    setSearchPanelCloseShortcut,
    appShortcuts,
    setAppShortcut,
    resetAppShortcuts,
    singleTabMode,
    confirmReset,
    setConfirmReset,
    selectedPlatform,
    setSelectedPlatform,
    wakeHotkey,
    quicknoteHotkey,
    searchHotkey,
    desktopHotkeys,
    handleReset,
    safeSetAppShortcut,
  };
}
