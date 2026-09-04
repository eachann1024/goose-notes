/**
 * Electron 桌面端全局热键注册（经 window.gooseDesktop.registerHotkeys）。
 *
 * 设置页存的快捷键格式是应用内通用格式（Mod/CmdOrCtrl/Meta/Ctrl…），
 * 主进程会转成 Electron accelerator。同一组合重复提交时主进程会保留已注册的键，
 * 避免 macOS 上立刻卸掉再挂导致默认快捷键失效。
 */
import type { HostHotkeyRegisterResult } from "@/lib/host/types";
import { toElectronAccelerator } from "./accelerator";
import { getGooseDesktop } from "./runtime";

export { toElectronAccelerator };

export type DesktopGlobalHotkeyId = "wake" | "quicknote" | "search";

const current = {
  wake: "",
  quicknote: "",
  search: "",
};

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function classify(ok: boolean): HostHotkeyRegisterResult {
  if (ok) return { ok: true };
  return { ok: false, state: "occupied", error: "快捷键已被其他应用占用或无效" };
}

export type DesktopGlobalHotkeySlot = {
  shortcut: string;
  enabled: boolean;
};

function resolvedShortcut(
  shortcut: string,
  enabled: boolean,
): { value: string; invalid: boolean } {
  if (!enabled || !shortcut.trim()) return { value: "", invalid: false };
  if (!toElectronAccelerator(shortcut)) return { value: "", invalid: true };
  return { value: shortcut, invalid: false };
}

function resultForSlot(
  slot: { value: string; invalid: boolean },
  ok: boolean,
  bridgeMissing: boolean,
): HostHotkeyRegisterResult {
  if (bridgeMissing) {
    return { ok: false, state: "error", error: "桌面桥不可用" };
  }
  if (!slot.value) {
    return slot.invalid
      ? { ok: false, state: "invalid", error: "快捷键无效" }
      : { ok: true };
  }
  return classify(ok);
}

/**
 * 三条全局热键一次提交。分三次 IPC 时，后开的窗口会带着空的另外两槽
 * 覆盖主进程，把已经注册好的小窗热键卸掉。
 */
export async function syncAllDesktopGlobalHotkeys(input: {
  wake: DesktopGlobalHotkeySlot;
  quicknote: DesktopGlobalHotkeySlot;
  search: DesktopGlobalHotkeySlot;
}): Promise<{
  wake: HostHotkeyRegisterResult;
  quicknote: HostHotkeyRegisterResult;
  search: HostHotkeyRegisterResult;
}> {
  const wake = resolvedShortcut(input.wake.shortcut, input.wake.enabled);
  const quicknote = resolvedShortcut(
    input.quicknote.shortcut,
    input.quicknote.enabled,
  );
  const search = resolvedShortcut(input.search.shortcut, input.search.enabled);
  current.wake = wake.value;
  current.quicknote = quicknote.value;
  current.search = search.value;

  const api = getGooseDesktop();
  if (!api) {
    return {
      wake: resultForSlot(wake, false, true),
      quicknote: resultForSlot(quicknote, false, true),
      search: resultForSlot(search, false, true),
    };
  }

  const result = await enqueue(async () => api.registerHotkeys({ ...current }));
  return {
    wake: resultForSlot(wake, result.wakeOk, false),
    quicknote: resultForSlot(quicknote, result.quicknoteOk, false),
    search: resultForSlot(search, result.searchOk, false),
  };
}

export async function registerDesktopGlobalHotkey(
  id: DesktopGlobalHotkeyId,
  shortcut: string,
): Promise<HostHotkeyRegisterResult> {
  const accelerator = toElectronAccelerator(shortcut);
  if (!accelerator) {
    current[id] = "";
    const api = getGooseDesktop();
    if (api) {
      await enqueue(async () => {
        await api.registerHotkeys({ ...current });
      });
    }
    return { ok: false, state: "invalid", error: "快捷键无效" };
  }
  current[id] = shortcut;
  const api = getGooseDesktop();
  if (!api) {
    return { ok: false, state: "error", error: "桌面桥不可用" };
  }
  const result = await enqueue(async () => api.registerHotkeys({ ...current }));
  const ok =
    id === "wake"
      ? result.wakeOk
      : id === "quicknote"
        ? result.quicknoteOk
        : result.searchOk;
  return classify(ok);
}

export async function unregisterDesktopGlobalHotkey(
  id: DesktopGlobalHotkeyId,
): Promise<void> {
  current[id] = "";
  const api = getGooseDesktop();
  if (!api) return;
  await enqueue(async () => {
    await api.registerHotkeys({ ...current });
  });
}
