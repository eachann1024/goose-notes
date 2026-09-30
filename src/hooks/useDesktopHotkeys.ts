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
import { isSetupGuideVisible } from "@/lib/setupGuide";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { syncAllDesktopGlobalHotkeys } from "@/lib/electron/globalHotkeys";
import {
  isShortcutRecorderTarget,
  shouldResumeGlobalHotkeysAfterFocusOut,
} from "@/lib/electron/hotkeyCapture";
import { useSettings } from "@/stores/useSettings";
import type { DesktopHotkeyStatus } from "@/stores/settings/types";
import type { HostHotkeyRegisterResult } from "@/lib/host/types";

function statusFromRegisterResult(
  enabled: boolean,
  shortcut: string,
  result: HostHotkeyRegisterResult,
  disabledMessage: string,
): DesktopHotkeyStatus {
  if (!enabled || !shortcut.trim()) {
    return { state: "disabled", message: disabledMessage };
  }
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
      if (isSetupGuideVisible(useSettings.getState())) return;
      window.dispatchEvent(new CustomEvent("goose-note:open-search"));
    });
  }, [hydrated]);

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron" || !hydrated) return;
    const api = getGooseDesktop();
    if (!api?.onWorkspaceAction) return;
    return api.onWorkspaceAction((action) => {
      if (isSetupGuideVisible(useSettings.getState())) return;
      if (action === "search") {
        window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        return;
      }
      if (action === "settings") {
        window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        return;
      }
      if (action === "ai-panel") {
        window.dispatchEvent(new CustomEvent("goose-note:open-ai-panel"));
        return;
      }
      if (action === "new-note") {
        window.dispatchEvent(new CustomEvent("goose-note:new-note"));
      }
    });
  }, [hydrated]);

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron" || !hydrated) return;
    let cancelled = false;

    void (async () => {
      const failed: HostHotkeyRegisterResult = {
        ok: false,
        state: "error",
        error: "桌面快捷键注册失败",
      };
      let result: {
        wake: HostHotkeyRegisterResult;
        quicknote: HostHotkeyRegisterResult;
        search: HostHotkeyRegisterResult;
      };
      try {
        result = await syncAllDesktopGlobalHotkeys({
          wake: { shortcut: wakeHotkey, enabled: wakeHotkeyEnabled },
          quicknote: {
            shortcut: quicknoteHotkey,
            enabled: quicknoteHotkeyEnabled,
          },
          search: { shortcut: searchHotkey, enabled: searchHotkeyEnabled },
        });
      } catch {
        result = { wake: failed, quicknote: failed, search: failed };
      }
      if (cancelled) return;
      const settings = useSettings.getState();
      settings.setWakeHotkeyStatus(
        statusFromRegisterResult(
          wakeHotkeyEnabled,
          wakeHotkey,
          result.wake,
          "已关闭主窗口全局快捷键",
        ),
      );
      settings.setQuicknoteHotkeyStatus(
        statusFromRegisterResult(
          quicknoteHotkeyEnabled,
          quicknoteHotkey,
          result.quicknote,
          "已关闭速记小窗全局快捷键",
        ),
      );
      settings.setSearchHotkeyStatus(
        statusFromRegisterResult(
          searchHotkeyEnabled,
          searchHotkey,
          result.search,
          "已关闭全局搜索快捷键",
        ),
      );
    })();

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

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron" || !hydrated) return;
    const api = getGooseDesktop();
    if (!api?.pauseHotkeys || !api?.resumeHotkeys) return;

    const applyRegisterResult = (result: {
      wakeOk: boolean;
      quicknoteOk: boolean;
      searchOk: boolean;
    }) => {
      const settings = useSettings.getState();
      const desktop = settings.desktop;
      settings.setWakeHotkeyStatus(
        !desktop.wakeHotkeyEnabled || !desktop.wakeHotkey.trim()
          ? { state: "disabled", message: "已关闭主窗口全局快捷键" }
          : result.wakeOk
            ? { state: "active" }
            : {
                state: "occupied",
                message: "快捷键已被其他应用占用或无效",
              },
      );
      settings.setQuicknoteHotkeyStatus(
        !desktop.quicknoteHotkeyEnabled || !desktop.quicknoteHotkey.trim()
          ? { state: "disabled", message: "已关闭速记小窗全局快捷键" }
          : result.quicknoteOk
            ? { state: "active" }
            : {
                state: "occupied",
                message: "快捷键已被其他应用占用或无效",
              },
      );
      settings.setSearchHotkeyStatus(
        !desktop.searchHotkeyEnabled || !desktop.searchHotkey.trim()
          ? { state: "disabled", message: "已关闭全局搜索快捷键" }
          : result.searchOk
            ? { state: "active" }
            : {
                state: "occupied",
                message: "快捷键已被其他应用占用或无效",
              },
      );
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isShortcutRecorderTarget(event.target)) return;
      void api.pauseHotkeys();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (
        !shouldResumeGlobalHotkeysAfterFocusOut(
          event.target,
          event.relatedTarget,
        )
      ) {
        return;
      }
      void api.resumeHotkeys().then(applyRegisterResult);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      void api.resumeHotkeys().then(applyRegisterResult);
    };
  }, [hydrated]);
}
