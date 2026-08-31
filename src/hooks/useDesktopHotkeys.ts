/**
 * Electron 桌面端全局热键注册（仅主应用 App 调用；速记小窗 lean 入口不注册）。
 *
 * 设置水合完成后按 desktop settings 注册两条热键：
 * - wake：主窗口唤出/隐藏
 * - quicknote：速记小窗唤出/隐藏
 * 改键/开关通过依赖变化热更新（先卸旧键再注册新键，见 lib/electron/globalHotkeys）。
 * 注册结果写回 desktop.*HotkeyStatus，供设置页展示 占用/无效/已关闭/错误。
 */
import { useEffect } from "react";
import { hostRuntime } from "@/lib/host";
import { useSettings } from "@/stores/useSettings";
import type { DesktopHotkeyStatus } from "@/stores/settings/types";

type DesktopHotkeyKind = "wake" | "quicknote";

async function syncDesktopHotkey(
  kind: DesktopHotkeyKind,
  shortcut: string,
  enabled: boolean,
): Promise<DesktopHotkeyStatus> {
  const register =
    kind === "wake"
      ? hostRuntime.registerWakeHotkey
      : hostRuntime.registerQuicknoteHotkey;
  const unregister =
    kind === "wake"
      ? hostRuntime.unregisterWakeHotkey
      : hostRuntime.unregisterQuicknoteHotkey;

  if (!enabled || !shortcut.trim()) {
    await unregister(shortcut);
    return {
      state: "disabled",
      message:
        kind === "wake" ? "已关闭主窗口全局快捷键" : "已关闭速记小窗全局快捷键",
    };
  }
  const result = await register(shortcut);
  if (result.ok) return { state: "active" };
  return {
    state: result.state ?? "error",
    message: result.error,
    rawError: result.error,
  };
}

export function useDesktopHotkeys(): void {
  const hydrated = useSettings((s) => s._hasHydrated);
  const wakeHotkey = useSettings((s) => s.desktop.wakeHotkey);
  const wakeHotkeyEnabled = useSettings((s) => s.desktop.wakeHotkeyEnabled);
  const quicknoteHotkey = useSettings((s) => s.desktop.quicknoteHotkey);
  const quicknoteHotkeyEnabled = useSettings(
    (s) => s.desktop.quicknoteHotkeyEnabled,
  );

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron" || !hydrated) return;
    let cancelled = false;

    const apply = async (
      kind: DesktopHotkeyKind,
      shortcut: string,
      enabled: boolean,
      setStatus: (status: DesktopHotkeyStatus) => void,
    ) => {
      const status = await syncDesktopHotkey(kind, shortcut, enabled);
      if (!cancelled) setStatus(status);
    };

    const settings = useSettings.getState();
    void apply(
      "wake",
      wakeHotkey,
      wakeHotkeyEnabled,
      settings.setWakeHotkeyStatus,
    );
    void apply(
      "quicknote",
      quicknoteHotkey,
      quicknoteHotkeyEnabled,
      settings.setQuicknoteHotkeyStatus,
    );

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    wakeHotkey,
    wakeHotkeyEnabled,
    quicknoteHotkey,
    quicknoteHotkeyEnabled,
  ]);
}
