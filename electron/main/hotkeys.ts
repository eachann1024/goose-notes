import { globalShortcut } from "electron";
import {
  getMainWindow,
  showAndFocusMainWindow,
  toggleQuicknoteWindow,
  toggleWindow,
} from "./windows";

const registered = {
  wake: "",
  quicknote: "",
  search: "",
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
    if (["super", "win", "windows"].includes(lower)) {
      if (!modifiers.includes("Super")) modifiers.push("Super");
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

function unregisterSlot(slot: "wake" | "quicknote" | "search"): void {
  const existing = registered[slot];
  if (!existing) return;
  try {
    globalShortcut.unregister(existing);
  } catch {
    // ignore
  }
  registered[slot] = "";
}

function isDuplicateAccelerator(
  accelerator: string,
  used: string[],
): boolean {
  return Boolean(accelerator) && used.includes(accelerator);
}

export function registerHotkeys(keys: {
  wake: string;
  quicknote: string;
  search: string;
}): { wakeOk: boolean; quicknoteOk: boolean; searchOk: boolean } {
  unregisterSlot("wake");
  unregisterSlot("quicknote");
  unregisterSlot("search");

  const result = { wakeOk: true, quicknoteOk: true, searchOk: true };

  const wakeAcc = keys.wake.trim() ? toElectronAccelerator(keys.wake) : "";
  const quickAcc = keys.quicknote.trim()
    ? toElectronAccelerator(keys.quicknote)
    : "";
  const searchAcc = keys.search.trim() ? toElectronAccelerator(keys.search) : "";

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

  const usedAfterWake = [registered.wake].filter(Boolean);

  if (keys.quicknote.trim()) {
    if (!quickAcc) {
      result.quicknoteOk = false;
    } else if (isDuplicateAccelerator(quickAcc, usedAfterWake)) {
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

  const usedAfterQuicknote = [registered.wake, registered.quicknote].filter(Boolean);

  if (keys.search.trim()) {
    if (!searchAcc) {
      result.searchOk = false;
    } else if (isDuplicateAccelerator(searchAcc, usedAfterQuicknote)) {
      result.searchOk = false;
    } else {
      try {
        result.searchOk = globalShortcut.register(searchAcc, () => {
          showAndFocusMainWindow();
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send("desktop:open-search");
          }
        });
        if (result.searchOk) registered.search = searchAcc;
      } catch {
        result.searchOk = false;
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
  registered.search = "";
}
