import { getPlatformKind, type PlatformKind } from "@/lib/utils";

const MOD_ALIASES = new Set([
  "mod",
  "cmdorctrl",
  "cmdorcontrol",
  "commandorcontrol",
]);
const META_ALIASES = new Set(["meta", "command", "cmd", "super", "win", "windows"]);
const CTRL_ALIASES = new Set(["ctrl", "control"]);
const ALT_ALIASES = new Set(["alt", "option"]);
const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"] as const;

export function resolveModModifier(
  platform: PlatformKind = getPlatformKind(),
): "meta" | "ctrl" {
  return platform === "mac" ? "meta" : "ctrl";
}

/** 系统键：macOS Command、Windows Win、Linux Super（Omarchy / Hyprland）。 */
export function formatSystemModifier(
  platform: PlatformKind = getPlatformKind(),
): string {
  if (platform === "mac") return "⌘";
  if (platform === "windows") return "Win";
  if (platform === "linux") return "Super";
  return "Meta";
}

export function formatShortcutToken(
  token: string,
  platform: PlatformKind = getPlatformKind(),
): string {
  const part = token.trim().toLowerCase();
  const isMac = platform === "mac";

  if (MOD_ALIASES.has(part)) {
    return isMac ? "⌘" : "Ctrl";
  }
  if (META_ALIASES.has(part)) {
    return formatSystemModifier(platform);
  }
  if (CTRL_ALIASES.has(part)) return isMac ? "⌃" : "Ctrl";
  if (ALT_ALIASES.has(part)) return isMac ? "⌥" : "Alt";
  if (part === "shift") return isMac ? "⇧" : "Shift";
  if (part === "plus") return "+";
  if (part === "enter" || part === "return") return "↵";
  if (part === "backspace") return "⌫";
  if (part === "tab") return "⇥";
  if (part === "esc" || part === "escape") return isMac ? "⎋" : "Esc";
  if (part === "up" || part === "arrowup") return "↑";
  if (part === "down" || part === "arrowdown") return "↓";
  if (part === "left" || part === "arrowleft") return "←";
  if (part === "right" || part === "arrowright") return "→";
  if (part === "mouseback") return "鼠标后退键";
  if (part === "mouseforward") return "鼠标前进键";
  return token.trim();
}

export function normalizeShortcutToken(
  raw: string,
  platform: PlatformKind = getPlatformKind(),
): string {
  const token = raw.trim().toLowerCase();
  if (!token) return "";
  if (MOD_ALIASES.has(token)) return resolveModModifier(platform);
  if (META_ALIASES.has(token)) return "meta";
  if (CTRL_ALIASES.has(token)) return "ctrl";
  if (ALT_ALIASES.has(token)) return "alt";
  if (token === "shift") return "shift";
  if (token === "escape" || token === "esc") return "esc";
  if (token === "+" || token === "plus") return "plus";
  if (token === " ") return "space";
  if (token === "arrowleft" || token === "left") return "left";
  if (token === "arrowright" || token === "right") return "right";
  if (token === "arrowup" || token === "up") return "up";
  if (token === "arrowdown" || token === "down") return "down";
  if (token === "enter" || token === "return") return "enter";
  return token;
}

export function normalizeShortcutForConflict(
  shortcut: string,
  platform: PlatformKind | boolean = getPlatformKind(),
): string {
  const resolvedPlatform =
    typeof platform === "boolean" ? (platform ? "mac" : "windows") : platform;
  const normalized = shortcut
    .split("+")
    .map((part) => normalizeShortcutToken(part, resolvedPlatform))
    .filter(Boolean);

  const modifiers = MODIFIER_ORDER.filter((part) => normalized.includes(part));
  const key = normalized.find(
    (part) => !MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number]),
  );
  return [...modifiers, ...(key ? [key] : [])].join("+");
}

/** 平台主键事件：macOS 只认 ⌘，Windows / Linux 只认 Ctrl，不把 Super/Win 当成 Mod。 */
export function isPlatformPrimaryModifierEvent(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey">,
  platform: PlatformKind = getPlatformKind(),
): boolean {
  if (platform === "mac") return event.metaKey && !event.ctrlKey;
  if (platform === "other") {
    return (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey);
  }
  return event.ctrlKey && !event.metaKey;
}

/**
 * 录制时把「当前平台主键」收成 Mod，Super/Win 保持独立。
 * macOS 的 ⌘ 与 Linux/Windows 的 Ctrl 因此是同一套可移植绑定。
 */
export function canonicalizeRecordedShortcut(
  shortcut: string,
  platform: PlatformKind = getPlatformKind(),
): string {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const primary = resolveModModifier(platform);
  const tokens = parts.map((part) => normalizeShortcutToken(part, platform));
  const hasCtrl = tokens.includes("ctrl");
  const hasMeta = tokens.includes("meta");

  const displayParts = parts.map((part) => {
    const token = normalizeShortcutToken(part, platform);
    if (token === primary && !(primary === "ctrl" && hasMeta) && !(primary === "meta" && hasCtrl)) {
      return "Mod";
    }
    if (token === "meta" && platform !== "mac") return "Super";
    if (token === "ctrl") return "Ctrl";
    if (token === "alt") return "Alt";
    if (token === "shift") return "Shift";
    return part;
  });

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const label of ["Mod", "Ctrl", "Super", "Meta", "Alt", "Shift"]) {
    const index = displayParts.findIndex(
      (part) => part.toLowerCase() === label.toLowerCase(),
    );
    if (index >= 0 && !seen.has(label)) {
      ordered.push(label === "Meta" && platform !== "mac" ? "Super" : label);
      seen.add(label);
    }
  }
  const key = displayParts.find(
    (part) => !["Mod", "Ctrl", "Super", "Meta", "Alt", "Shift"].includes(part),
  );
  if (key) ordered.push(key);
  return ordered.join("+");
}

export const EDITOR_ONLY_FIXED_SHORTCUTS = [
  "Mod+B",
  "Mod+I",
  "Mod+U",
  "Mod+E",
  "Mod+K",
  "Mod+Shift+S",
] as const;
