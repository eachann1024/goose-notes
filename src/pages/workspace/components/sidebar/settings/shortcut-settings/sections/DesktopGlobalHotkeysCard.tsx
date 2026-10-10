import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { formatShortcut, isMacPlatform } from "@/lib/utils";
import { normalizeShortcutForConflict } from "@/lib/shortcut-platform";
import {
  DEFAULT_WAKE_HOTKEY,
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  useSettings,
} from "@/stores/useSettings";
import type { DesktopHotkeyStatus } from "@/stores/settings/types";
import { SettingsSectionCard } from "../../SettingsSectionCard";
import { ShortcutField } from "../../ShortcutField";
import { SETTINGS_OPTION_ROW_CLASS } from "./shortcutConfig";
import { getAllConfiguredShortcuts } from "./shortcutConflict";

export /** 桌面全局快捷键状态文案（占用/无效/已关闭/错误/已生效）。 */
function desktopHotkeyStatusText(status: DesktopHotkeyStatus): {
  text: string;
  isError: boolean;
} {
  switch (status.state) {
    case "active":
      return { text: "已生效", isError: false };
    case "occupied":
      return {
        text: `快捷键被占用${status.message ? `：${status.message}` : ""}`,
        isError: true,
      };
    case "invalid":
      return { text: "快捷键无效，请重新录制", isError: true };
    case "disabled":
      return { text: status.message || "已关闭", isError: false };
    case "error":
      return {
        text: `注册失败${status.message ? `：${status.message}` : ""}`,
        isError: true,
      };
    default:
      return { text: "", isError: false };
  }
}

export /** 「桌面全局快捷键」分区：仅 Electron 桌面端渲染。 */
function DesktopGlobalHotkeysCard({
  appShortcuts,
  closeTabShortcut,
  searchPanelCloseShortcut,
  singleTabMode,
}: {
  appShortcuts: Record<string, string>;
  closeTabShortcut: string;
  searchPanelCloseShortcut: string;
  singleTabMode: boolean;
}) {
  const desktop = useSettings((s) => s.desktop);
  const setWakeHotkey = useSettings((s) => s.setWakeHotkey);
  const setWakeHotkeyEnabled = useSettings((s) => s.setWakeHotkeyEnabled);
  const setQuicknoteHotkey = useSettings((s) => s.setQuicknoteHotkey);
  const setQuicknoteHotkeyEnabled = useSettings(
    (s) => s.setQuicknoteHotkeyEnabled,
  );
  const setSearchHotkey = useSettings((s) => s.setSearchHotkey);
  const setSearchHotkeyEnabled = useSettings((s) => s.setSearchHotkeyEnabled);
  const [macAccessibilityNeeded, setMacAccessibilityNeeded] = useState(false);

  useEffect(() => {
    const api = getGooseDesktop();
    if (!api?.getAccessibilityStatus) return;
    let cancelled = false;
    const refresh = () => {
      void api.getAccessibilityStatus().then((status) => {
        if (cancelled) return;
        setMacAccessibilityNeeded(
          status.platform === "darwin" && !status.trusted,
        );
      });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const makeDesktopSetter =
    (
      excludeId: "wake-hotkey" | "quicknote-hotkey" | "search-hotkey",
      setHotkey: (shortcut: string) => void,
      setEnabled: (enabled: boolean) => void,
    ) =>
    (shortcut: string) => {
      // 清空 = 禁用
      if (!shortcut) {
        setHotkey("");
        setEnabled(false);
        return;
      }
      const existing = getAllConfiguredShortcuts(
        appShortcuts,
        closeTabShortcut,
        searchPanelCloseShortcut,
        excludeId,
        isMacPlatform(),
        singleTabMode,
        {
          wakeHotkey: desktop.wakeHotkey,
          quicknoteHotkey: desktop.quicknoteHotkey,
          searchHotkey: desktop.searchHotkey,
        },
      );
      if (existing.includes(normalizeShortcutForConflict(shortcut))) {
        toast.warning("快捷键冲突", {
          description: `${formatShortcut(shortcut)} 已被其他操作占用，请选择其他快捷键。`,
        });
        return;
      }
      setHotkey(shortcut);
      setEnabled(true);
    };

  const wakeStatus = desktopHotkeyStatusText(desktop.wakeHotkeyStatus);
  const quicknoteStatus = desktopHotkeyStatusText(
    desktop.quicknoteHotkeyStatus,
  );
  const searchStatus = desktopHotkeyStatusText(desktop.searchHotkeyStatus);

  return (
    <SettingsSectionCard title="桌面全局快捷键">
      <p className="mb-3 text-xs text-muted-foreground">
        在任何应用前台时均可唤出。再次按下时在聚焦、隐藏与显示之间快速切换。
      </p>
      {macAccessibilityNeeded && (
        <div
          className={`mb-3 flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <p className="text-xs text-muted-foreground">
            macOS 需要在「系统设置 › 隐私与安全性 › 辅助功能」中允许 Goose
            Note，全局快捷键才能在其他应用前台时唤出主窗口和速记小窗。
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-[10px]"
            onClick={() => {
              void getGooseDesktop()?.requestAccessibility?.();
            }}
          >
            前往辅助功能设置
          </Button>
        </div>
      )}
      <ShortcutField
        id="wake-hotkey"
        title="唤出 / 隐藏主窗口"
        description="在任意应用前台时快速呼出或收起主窗口。"
        value={desktop.wakeHotkeyEnabled ? desktop.wakeHotkey : ""}
        onChange={makeDesktopSetter(
          "wake-hotkey",
          setWakeHotkey,
          setWakeHotkeyEnabled,
        )}
        resetValue={DEFAULT_WAKE_HOTKEY}
      />
      {wakeStatus.text && (
        <p
          className={`mt-1 pl-4 text-[11px] ${wakeStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
        >
          {wakeStatus.text}
        </p>
      )}
      <div className="mt-2">
        <ShortcutField
          id="quicknote-hotkey"
          title="唤出 / 隐藏速记小窗"
          description="随时随地呼出独立悬浮便签，随手记录灵感。"
          value={desktop.quicknoteHotkeyEnabled ? desktop.quicknoteHotkey : ""}
          onChange={makeDesktopSetter(
            "quicknote-hotkey",
            setQuicknoteHotkey,
            setQuicknoteHotkeyEnabled,
          )}
          resetValue={DEFAULT_QUICKNOTE_HOTKEY}
        />
        {quicknoteStatus.text && (
          <p
            className={`mt-1 pl-4 text-[11px] ${quicknoteStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
          >
            {quicknoteStatus.text}
          </p>
        )}
      </div>
      <div className="mt-2">
        <ShortcutField
          id="search-hotkey"
          title="全局唤出搜索面板"
          description="在其他应用前台时快速呼出搜索面板。清空输入框可停用；与应用内搜索相互独立。"
          value={desktop.searchHotkeyEnabled ? desktop.searchHotkey : ""}
          onChange={makeDesktopSetter(
            "search-hotkey",
            setSearchHotkey,
            setSearchHotkeyEnabled,
          )}
          resetValue={DEFAULT_SEARCH_HOTKEY}
        />
        {searchStatus.text && (
          <p
            className={`mt-1 pl-4 text-[11px] ${searchStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
          >
            {searchStatus.text}
          </p>
        )}
      </div>
    </SettingsSectionCard>
  );
}
