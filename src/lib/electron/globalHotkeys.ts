/**
 * Electron 桌面端全局热键注册（经 window.gooseDesktop.registerHotkeys）。
 *
 * 设置页存的快捷键格式是应用内通用格式（Mod/CmdOrCtrl/Meta/Ctrl…），
 * 主进程会转成 Electron accelerator。同一 id 重复注册会先卸载旧键再注册新键。
 */
import type { HostHotkeyRegisterResult } from "@/lib/host/types";
import { getGooseDesktop } from "./runtime";

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

/** 应用内快捷键格式 → Electron accelerator。无法识别时返回空串。 */
export function toElectronAccelerator(shortcut: string): string {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const modifiers: string[] = [];
  let key = "";
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (["mod", "cmdorctrl", "cmdorcontrol", "commandorcontrol"].includes(lower)) {
      if (!modifiers.includes("CommandOrControl")) modifiers.push("CommandOrControl");
      continue;
    }
    if (["meta", "command", "cmd"].includes(lower)) {
      if (!modifiers.includes("Command")) modifiers.push("Command");
      continue;
    }
    if (["ctrl", "control"].includes(lower)) {
      if (!modifiers.includes("Control")) modifiers.push("Control");
      continue;
    }
    if (["alt", "option"].includes(lower)) {
      if (!modifiers.includes("Alt")) modifiers.push("Alt");
      continue;
    }
    if (lower === "shift") {
      if (!modifiers.includes("Shift")) modifiers.push("Shift");
      continue;
    }
    if (key) return "";
    key = part;
  }
  if (!key) return "";

  const namedKeys: Record<string, string> = {
    esc: "Escape",
    escape: "Escape",
    space: "Space",
    plus: "Plus",
    enter: "Enter",
    return: "Enter",
    tab: "Tab",
    backspace: "Backspace",
    delete: "Delete",
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
  };
  const lowerKey = key.toLowerCase();
  if (namedKeys[lowerKey]) {
    key = namedKeys[lowerKey];
  } else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lowerKey)) {
    key = lowerKey.toUpperCase();
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  return [...modifiers, key].join("+");
}

function classify(ok: boolean): HostHotkeyRegisterResult {
  if (ok) return { ok: true };
  return { ok: false, state: "occupied", error: "快捷键已被其他应用占用或无效" };
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
