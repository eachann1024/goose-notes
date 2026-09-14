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

export type AcceleratorKeyInput = {
  type?: string;
  key?: string;
  code?: string;
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

function acceleratorKeyMatches(
  input: AcceleratorKeyInput,
  acceleratorKey: string,
): boolean {
  const target = acceleratorKey.toLowerCase();
  const key = (input.key ?? "").toLowerCase();
  const code = input.code ?? "";
  if (target === "space") {
    return key === " " || key === "space" || code === "Space";
  }
  if (target === "enter") {
    return key === "enter" || code === "Enter";
  }
  if (target === "escape") {
    return key === "escape" || code === "Escape";
  }
  if (target === "tab") {
    return key === "tab" || code === "Tab";
  }
  if (target === "plus") {
    return key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
  }
  if (target.length === 1 && /[a-z]/.test(target)) {
    return key === target || code === `Key${target.toUpperCase()}`;
  }
  if (target.length === 1 && /[0-9]/.test(target)) {
    return key === target || code === `Digit${target}` || code === `Numpad${target}`;
  }
  return key === target || code.toLowerCase() === target.toLowerCase();
}

function inputMatchesExactAccelerator(
  input: AcceleratorKeyInput,
  accelerator: string,
  platform: AcceleratorPlatform,
): boolean {
  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  const key = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  if (!key || modifiers.has(key.toLowerCase())) return false;

  const commandOrControl =
    modifiers.has("commandorcontrol") || modifiers.has("cmdorctrl");
  const wantMeta =
    modifiers.has("command") ||
    modifiers.has("cmd") ||
    modifiers.has("meta") ||
    (commandOrControl && platform === "darwin");
  const wantControl =
    modifiers.has("control") ||
    modifiers.has("ctrl") ||
    (commandOrControl && platform !== "darwin");
  const wantAlt = modifiers.has("alt") || modifiers.has("option");
  const wantShift = modifiers.has("shift");
  const wantSuper =
    modifiers.has("super") || modifiers.has("win") || modifiers.has("windows");

  if (Boolean(input.meta) !== wantMeta) return false;
  if (Boolean(input.control) !== wantControl) return false;
  if (Boolean(input.alt) !== wantAlt) return false;
  if (Boolean(input.shift) !== wantShift) return false;
  if (wantSuper && !input.meta) return false;
  return acceleratorKeyMatches(input, key);
}

/** 主进程 before-input-event 与已注册 accelerator 对齐，供前台窗补全局热键。 */
export function inputMatchesAccelerator(
  input: AcceleratorKeyInput,
  accelerator: string,
  platform: AcceleratorPlatform = "darwin",
): boolean {
  if (!accelerator) return false;
  if (input.type && input.type !== "keyDown") return false;
  return electronAcceleratorAliases(accelerator, platform).some((alias) =>
    inputMatchesExactAccelerator(input, alias, platform),
  );
}
