/**
 * Electron 桌面端全局热键注册（仅主应用 App 调用；速记小窗 lean 入口不注册）。
 *
 * 设置水合完成后按 desktop settings 注册三条热键：
 * - wake：主窗口唤出/隐藏
 * - quicknote：速记小窗唤出/隐藏
 * - search：聚焦主窗并打开搜索面板
 * 改键/开关通过依赖变化热更新（先卸旧键再注册新键，见 lib/electron/globalHotkeys）。
 * 注册结果写回 desktop.*HotkeyStatus，供设置页展示 占用/无效/已关闭/错误。
 */
import { useEffect } from "react";
import { hostRuntime } from "@/lib/host";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { useSettings } from "@/stores/useSettings";
import type { DesktopHotkeyStatus } from "@/stores/settings/types";

type DesktopHotkeyKind = "wake" | "quicknote" | "search";

async function syncDesktopHotkey(
  kind: DesktopHotkeyKind,
  shortcut: string,
  enabled: boolean,
): Promise<DesktopHotkeyStatus> {
  const register =
    kind === "wake"
      ? hostRuntime.registerWakeHotkey
      : kind === "quicknote"
        ? hostRuntime.registerQuicknoteHotkey
        : hostRuntime.registerSearchHotkey;
  const unregister =
    kind === "wake"
      ? hostRuntime.unregisterWakeHotkey
      : kind === "quicknote"
        ? hostRuntime.unregisterQuicknoteHotkey
        : hostRuntime.unregisterSearchHotkey;

  if (!enabled || !shortcut.trim()) {
    await unregister(shortcut);
    const message =
      kind === "wake"
        ? "已关闭主窗口全局快捷键"
        : kind === "quicknote"
          ? "已关闭速记小窗全局快捷键"
          : "已关闭全局搜索快捷键";
    return { state: "disabled", message };
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
  const searchHotkey = useSettings((s) => s.desktop.searchHotkey);
  const searchHotkeyEnabled = useSettings((s) => s.desktop.searchHotkeyEnabled);

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron" || !hydrated) return;
    const api = getGooseDesktop();
    if (!api?.onOpenSearch) return;
    return api.onOpenSearch(() => {
      window.dispatchEvent(new CustomEvent("goose-note:open-search"));
    });
  }, [hydrated]);

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
    void apply(
      "search",
      searchHotkey,
      searchHotkeyEnabled,
      settings.setSearchHotkeyStatus,
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
    searchHotkey,
    searchHotkeyEnabled,
  ]);
}
