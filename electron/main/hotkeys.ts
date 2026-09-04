import { globalShortcut } from "electron";
import {
  electronAcceleratorAliases,
  electronAcceleratorsMatch,
  toElectronAccelerator,
} from "../../src/lib/electron/accelerator";
import {
  getMainWindow,
  showAndFocusMainWindow,
  toggleQuicknoteWindow,
  toggleWindow,
} from "./windows";

export { toElectronAccelerator };

const registered = {
  wake: "",
  quicknote: "",
  search: "",
};

type HotkeySlot = "wake" | "quicknote" | "search";
type HotkeyRequest = { wake: string; quicknote: string; search: string };

const lastRequested: HotkeyRequest = {
  wake: "",
  quicknote: "",
  search: "",
};

let paused = false;

function unregisterSlot(slot: HotkeySlot): void {
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
  return (
    Boolean(accelerator) &&
    used.some((item) =>
      electronAcceleratorsMatch(item, accelerator, process.platform),
    )
  );
}

function copyHotkeyRequest(keys: HotkeyRequest): HotkeyRequest {
  return {
    wake: keys.wake ?? "",
    quicknote: keys.quicknote ?? "",
    search: keys.search ?? "",
  };
}

function tryRegisterAccelerator(
  accelerator: string,
  callback: () => void,
): string {
  for (const candidate of electronAcceleratorAliases(
    accelerator,
    process.platform,
  )) {
    try {
      if (globalShortcut.register(candidate, callback)) return candidate;
    } catch {
      // try the next alias
    }
  }
  return "";
}

function applyRegistration(keys: HotkeyRequest): {
  wakeOk: boolean;
  quicknoteOk: boolean;
  searchOk: boolean;
} {
  const wakeAcc = keys.wake.trim() ? toElectronAccelerator(keys.wake) : "";
  const quickAcc = keys.quicknote.trim()
    ? toElectronAccelerator(keys.quicknote)
    : "";
  const searchAcc = keys.search.trim() ? toElectronAccelerator(keys.search) : "";
  const next = { wake: wakeAcc, quicknote: quickAcc, search: searchAcc };

  // 键没变就别卸：macOS 对同一 accelerator 立刻 unregister+register 经常返回 false。
  for (const slot of ["wake", "quicknote", "search"] as const) {
    if (
      registered[slot] &&
      !electronAcceleratorsMatch(registered[slot], next[slot], process.platform)
    ) {
      unregisterSlot(slot);
    }
  }

  const used: string[] = [];

  const bindSlot = (
    slot: HotkeySlot,
    acc: string,
    requested: string,
    callback: () => void,
  ): boolean => {
    if (!requested.trim()) return true;
    if (!acc) return false;
    if (isDuplicateAccelerator(acc, used)) return false;
    if (electronAcceleratorsMatch(registered[slot], acc, process.platform)) {
      used.push(registered[slot] || acc);
      return true;
    }
    const actual = tryRegisterAccelerator(acc, callback);
    if (!actual) return false;
    registered[slot] = actual;
    used.push(actual);
    return true;
  };

  return {
    wakeOk: bindSlot("wake", wakeAcc, keys.wake, () => {
      void toggleWindow(getMainWindow());
    }),
    quicknoteOk: bindSlot("quicknote", quickAcc, keys.quicknote, () => {
      void toggleQuicknoteWindow();
    }),
    searchOk: bindSlot("search", searchAcc, keys.search, () => {
      showAndFocusMainWindow();
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("desktop:open-search");
      }
    }),
  };
}

export function registerHotkeys(keys: HotkeyRequest): {
  wakeOk: boolean;
  quicknoteOk: boolean;
  searchOk: boolean;
} {
  Object.assign(lastRequested, copyHotkeyRequest(keys));
  if (paused) {
    return { wakeOk: true, quicknoteOk: true, searchOk: true };
  }
  return applyRegistration(lastRequested);
}

/** 录制快捷键时先卸掉全局热键，否则系统会先吃掉按键，输入框收不到。 */
export function pauseGlobalHotkeys(): void {
  paused = true;
  unregisterSlot("wake");
  unregisterSlot("quicknote");
  unregisterSlot("search");
}

export function resumeGlobalHotkeys(): {
  wakeOk: boolean;
  quicknoteOk: boolean;
  searchOk: boolean;
} {
  paused = false;
  return applyRegistration(lastRequested);
}

export function unregisterAllHotkeys(): void {
  paused = false;
  try {
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
  registered.wake = "";
  registered.quicknote = "";
  registered.search = "";
}
