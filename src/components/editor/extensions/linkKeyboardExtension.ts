import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
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

/** 按住 Cmd/Ctrl 时编辑器进入可打开链接的提示态，与 links.onClick 判定一致。 */
export const LINK_ARMED_CLASS = "goose-link-armed";

export function shouldArmLinkOpenHint(
  event: Pick<KeyboardEvent | MouseEvent, "metaKey" | "ctrlKey">,
): boolean {
  return Boolean(event.metaKey || event.ctrlKey);
}

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

const linkArmedPluginKey = new PluginKey("goose-link-armed");

function createLinkArmedPlugin() {
  return new Plugin({
    key: linkArmedPluginKey,
    view(view: EditorView) {
      const syncArmed = (event: KeyboardEvent | MouseEvent) => {
        view.dom.classList.toggle(LINK_ARMED_CLASS, shouldArmLinkOpenHint(event));
      };
      const disarm = () => view.dom.classList.remove(LINK_ARMED_CLASS);
      const onVisibility = () => {
        if (document.hidden) disarm();
      };
      window.addEventListener("keydown", syncArmed);
      window.addEventListener("keyup", syncArmed);
      window.addEventListener("mousemove", syncArmed);
      window.addEventListener("blur", disarm);
      document.addEventListener("visibilitychange", onVisibility);
      return {
        destroy() {
          window.removeEventListener("keydown", syncArmed);
          window.removeEventListener("keyup", syncArmed);
          window.removeEventListener("mousemove", syncArmed);
          window.removeEventListener("blur", disarm);
          document.removeEventListener("visibilitychange", onVisibility);
          disarm();
        },
      };
    },
  });
}

export const createGooseLinkKeyboardExtension = (
  settingsRef: MutableRefObject<EditorSettings>,
) =>
  createExtension({
    key: "goose-link-keyboard",
    prosemirrorPlugins: [createLinkArmedPlugin()],
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
