import { createExtension } from "@blocknote/core";
import { getEditorPlatform } from "@/components/editor/platform/context";
import type { EditorSettings } from "@/components/editor/platform/hostContext";
import type { MutableRefObject } from "react";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import {
  isPlatformPrimaryModifierEvent,
  normalizeShortcutForConflict,
} from "@/lib/shortcut-platform";
import { getPlatformKind, type PlatformKind } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";

type LinkShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "code"
  | "ctrlKey"
  | "metaKey"
  | "altKey"
  | "shiftKey"
  | "repeat"
  | "defaultPrevented"
> &
  Partial<Pick<KeyboardEvent, "isComposing" | "keyCode" | "which">> & {
    nativeEvent?: Pick<KeyboardEvent, "isComposing" | "keyCode" | "which">;
  };

/** 仅匹配当前平台的 Mod+K（macOS ⌘K / Windows·Linux Ctrl+K），不把 Super/Win 当成链接键。 */
export function isPrimaryLinkShortcutEvent(
  event: LinkShortcutEvent,
  platform: PlatformKind = getPlatformKind(),
) {
  return (
    !event.defaultPrevented &&
    !isImeKeyboardEvent(event.nativeEvent ?? {}) &&
    !isImeKeyboardEvent(event) &&
    !event.repeat &&
    !event.altKey &&
    !event.shiftKey &&
    isPlatformPrimaryModifierEvent(event, platform) &&
    (event.key.toLowerCase() === "k" || event.code === "KeyK")
  );
}

export function isLinkShortcutClaimedByApp(
  shortcuts: Iterable<string | undefined>,
  platform: PlatformKind = getPlatformKind(),
) {
  const link = normalizeShortcutForConflict("Mod+K", platform);
  for (const shortcut of shortcuts) {
    if (!shortcut) continue;
    if (normalizeShortcutForConflict(shortcut, platform) === link) return true;
  }
  return false;
}

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const createGooseLinkKeyboardExtension = (
  settingsRef: MutableRefObject<EditorSettings>,
) =>
  createExtension({
    key: "goose-link-keyboard",
    keyboardShortcuts: {
      "Mod-k": ({ editor }) => {
        const settings = useSettings.getState();
        if (
          isLinkShortcutClaimedByApp([
            ...Object.values(settings.appShortcuts),
            settings.closeTabShortcut,
            settings.searchPanelCloseShortcut,
          ])
        ) {
          return false;
        }
        const url = editor.getSelectedLinkUrl();
        if (url) {
          editor.deleteLink();
          return true;
        }
        const selectedText = editor.getSelectedText();
        if (selectedText) {
          document.dispatchEvent(new CustomEvent("goose-open-link-popover"));
          return true;
        }
        return false;
      },
      "Alt-Enter": ({ editor }) => {
        const url = editor.getSelectedLinkUrl();
        if (url) {
          const target = normalizeExternalUrl(url);
          if (target) {
            // 动态读取 React Ref 里的最新设置，避免闭包捕获陈旧状态
            void getEditorPlatform().shell.openUrl(
              target,
              settingsRef.current.openLinksInHost,
            );
          }
          return true;
        }
        return false;
      },
    },
  });
