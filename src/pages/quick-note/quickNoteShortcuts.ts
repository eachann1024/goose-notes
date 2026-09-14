import type { QuickNoteSlot } from "@/stores/useQuickNote";
import { getPlatformKind } from "@/lib/utils";
import { matchShortcut } from "@/lib/shortcut-match";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { SELECTION_QUOTE_ADD_SHORTCUT } from "@/components/editor/ai/composer/selectionQuote";
import type { DesktopWorkspaceAction } from "@/lib/electron/windowToggle";

/** 小窗斜杠菜单里这些项会打开主窗口，而不是在窄窗里硬塞重型块。 */
export const QUICKNOTE_MAIN_WINDOW_SLASH_TITLES = new Set([
  "表格",
  "数学公式",
  "Mermaid 图表",
  "视频",
  "文件",
]);

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

interface QuickNoteShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

/** 原生表单和非正文 contenteditable 保留浏览器自己的编辑快捷键。 */
export function shouldQuickNoteEditableTargetOwnShortcut(
  target: QuickNoteShortcutTarget | null,
) {
  if (!target) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "")) {
    return true;
  }
  if (target.closest?.(".bn-editor")) return false;
  return target.isContentEditable === true;
}

export function isWindowsQuickNotePlatform(): boolean {
  return getPlatformKind() === "windows";
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

export function getQuickNoteWorkspaceAction(
  event: KeyboardEvent,
  shortcuts: {
    openSearch?: string;
    openSettings?: string;
    toggleAIPanel?: string;
    newNote?: string;
  },
): DesktopWorkspaceAction | null {
  if (event.repeat || event.defaultPrevented) return null;
  const fixed = getFixedAppShortcuts();
  const candidates: Array<[DesktopWorkspaceAction, string | undefined]> = [
    ["settings", shortcuts.openSettings || fixed.openSettings],
    ["search", shortcuts.openSearch],
    ["ai-panel", shortcuts.toggleAIPanel],
    ["new-note", shortcuts.newNote || fixed.newNote],
    ["ai-panel", SELECTION_QUOTE_ADD_SHORTCUT],
  ];
  for (const [action, shortcut] of candidates) {
    if (!shortcut || !matchShortcut(event, shortcut)) continue;
    return action;
  }
  return null;
}

export function rewriteQuickNoteSlashItemForMainWindow<
  T extends {
    title?: string;
    description?: string;
    onItemClick?: () => void;
  },
>(item: T, openMainWindow: () => void): T {
  if (!item.title || !QUICKNOTE_MAIN_WINDOW_SLASH_TITLES.has(item.title)) {
    return item;
  }
  return {
    ...item,
    description: "需在主窗口使用",
    onItemClick: openMainWindow,
  };
}
