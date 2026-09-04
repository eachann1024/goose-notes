/**
 * 应用内快捷键格式 → Electron accelerator。
 * 主进程与渲染进程共用；无法识别时返回空串。
 */
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

type AcceleratorPlatform = "darwin" | "win32" | "linux" | string;

/** 同一组合的 Electron 写法（unregister 必须用当时真正 register 的那条）。 */
export function electronAcceleratorAliases(
  accelerator: string,
  platform: AcceleratorPlatform = "darwin",
): string[] {
  if (!accelerator) return [];
  const aliases = [accelerator];
  if (accelerator.includes("CommandOrControl")) {
    aliases.push(accelerator.replaceAll("CommandOrControl", "CmdOrCtrl"));
    aliases.push(
      accelerator.replaceAll(
        "CommandOrControl",
        platform === "darwin" ? "Command" : "Control",
      ),
    );
  }
  return [...new Set(aliases)];
}

export function electronAcceleratorsMatch(
  left: string,
  right: string,
  platform: AcceleratorPlatform = "darwin",
): boolean {
  if (!left || !right) return left === right;
  if (left === right) return true;
  const rightAliases = new Set(electronAcceleratorAliases(right, platform));
  return electronAcceleratorAliases(left, platform).some((item) =>
    rightAliases.has(item),
  );
}
