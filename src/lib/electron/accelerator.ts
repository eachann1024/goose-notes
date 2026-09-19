/**
 * 应用内快捷键格式 → Electron accelerator。
 * 主进程与渲染进程共用；无法识别时返回空串。
 */
export type AcceleratorPlatform = "darwin" | "win32" | "linux" | string;

function resolveAcceleratorPlatform(
  platform?: AcceleratorPlatform,
): AcceleratorPlatform {
  if (platform) return platform;
  if (typeof process !== "undefined" && typeof process.platform === "string") {
    return process.platform;
  }
  return "darwin";
}

/**
 * 应用内快捷键 → Electron accelerator。
 * Windows/Linux 上 Meta/Cmd 必须映射为 Super（Win 键）；Electron 文档写明
 * Command 在 Win/Linux 上无效，否则 globalShortcut 注册失败或根本不触发。
 */
export function toElectronAccelerator(
  shortcut: string,
  platform?: AcceleratorPlatform,
): string {
  const resolvedPlatform = resolveAcceleratorPlatform(platform);
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
      // macOS → Command；Windows/Linux → Super（物理 Win/Super 键）
      const token = resolvedPlatform === "darwin" ? "Command" : "Super";
      if (!modifiers.includes(token)) modifiers.push(token);
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
  // Win/Linux：Super / Meta / Win 互通（录制存 Super，旧数据可能是 Meta）
  if (platform !== "darwin") {
    if (accelerator.includes("Super")) {
      aliases.push(accelerator.replaceAll("Super", "Meta"));
      aliases.push(accelerator.replaceAll("Super", "Win"));
    }
    if (accelerator.includes("Meta")) {
      aliases.push(accelerator.replaceAll("Meta", "Super"));
      aliases.push(accelerator.replaceAll("Meta", "Win"));
    }
    if (/(^|\+)Win(\+|$)/.test(accelerator)) {
      aliases.push(accelerator.replaceAll("Win", "Super"));
      aliases.push(accelerator.replaceAll("Win", "Meta"));
    }
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
  const wantAlt = modifiers.has("alt") || modifiers.has("option");
  const wantShift = modifiers.has("shift");
  const wantSuper =
    modifiers.has("super") || modifiers.has("win") || modifiers.has("windows");
  const wantCommand =
    modifiers.has("command") || modifiers.has("cmd") || modifiers.has("meta");

  // Chromium：macOS Command 与 Windows Win / Linux Super 都体现在 meta 位上。
  const wantMetaKey =
    platform === "darwin"
      ? wantCommand || wantSuper || (commandOrControl && true)
      : wantSuper || wantCommand;
  const wantControl =
    modifiers.has("control") ||
    modifiers.has("ctrl") ||
    (commandOrControl && platform !== "darwin");

  if (Boolean(input.meta) !== Boolean(wantMetaKey)) return false;
  if (Boolean(input.control) !== wantControl) return false;
  if (Boolean(input.alt) !== wantAlt) return false;
  if (Boolean(input.shift) !== wantShift) return false;
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
