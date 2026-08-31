import { globalShortcut } from "electron";
import { getMainWindow, toggleQuicknoteWindow, toggleWindow } from "./windows";

const registered = {
  wake: "",
  quicknote: "",
};

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

function unregisterSlot(slot: "wake" | "quicknote"): void {
  const existing = registered[slot];
  if (!existing) return;
  try {
    globalShortcut.unregister(existing);
  } catch {
    // ignore
  }
  registered[slot] = "";
}

export function registerHotkeys(keys: {
  wake: string;
  quicknote: string;
}): { wakeOk: boolean; quicknoteOk: boolean } {
  unregisterSlot("wake");
  unregisterSlot("quicknote");

  const result = { wakeOk: true, quicknoteOk: true };

  const wakeAcc = keys.wake.trim() ? toElectronAccelerator(keys.wake) : "";
  const quickAcc = keys.quicknote.trim()
    ? toElectronAccelerator(keys.quicknote)
    : "";

  if (keys.wake.trim()) {
    if (!wakeAcc) {
      result.wakeOk = false;
    } else {
      try {
        result.wakeOk = globalShortcut.register(wakeAcc, () => {
          void toggleWindow(getMainWindow());
        });
        if (result.wakeOk) registered.wake = wakeAcc;
      } catch {
        result.wakeOk = false;
      }
    }
  }

  if (keys.quicknote.trim()) {
    if (!quickAcc) {
      result.quicknoteOk = false;
    } else if (quickAcc === wakeAcc) {
      result.quicknoteOk = false;
    } else {
      try {
        result.quicknoteOk = globalShortcut.register(quickAcc, () => {
          void toggleQuicknoteWindow();
        });
        if (result.quicknoteOk) registered.quicknote = quickAcc;
      } catch {
        result.quicknoteOk = false;
      }
    }
  }

  return result;
}

export function unregisterAllHotkeys(): void {
  try {
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
  registered.wake = "";
  registered.quicknote = "";
}
