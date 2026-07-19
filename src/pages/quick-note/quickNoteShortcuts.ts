import type { QuickNoteSlot } from "@/stores/useQuickNote";

interface QuickNoteSlotShortcutEvent {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

export function isWindowsQuickNotePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Windows|Win32|Win64/i.test(
    `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`,
  );
}

export function getQuickNoteSlotShortcut(
  event: QuickNoteSlotShortcutEvent,
  isWindows = isWindowsQuickNotePlatform(),
): QuickNoteSlot | null {
  if (event.shiftKey || event.repeat || event.isComposing) return null;

  const codeMatch = /^Digit([1-5])$/.exec(event.code);
  const keyMatch = /^([1-5])$/.exec(event.key);
  const slotText = codeMatch?.[1] ?? keyMatch?.[1];
  if (!slotText) return null;

  const commandShortcut = (event.metaKey || event.ctrlKey) && !event.altKey;
  const windowsAltShortcut =
    isWindows && event.altKey && !event.metaKey && !event.ctrlKey;
  if (!commandShortcut && !windowsAltShortcut) return null;

  return Number(slotText) as QuickNoteSlot;
}
