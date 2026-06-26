import { createExtension } from "@blocknote/core";
import { getEditorPlatform } from "@/components/editor/platform/context";
import { getEditorSettings } from "@/components/editor/platform/hostContext";

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const gooseLinkKeyboardExtension = createExtension({
  key: "goose-link-keyboard",
  keyboardShortcuts: {
    "Mod-k": ({ editor }) => {
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
          const useInternalBrowser = getEditorSettings()?.utools?.openSearchInUtools ?? false;
          void getEditorPlatform().shell.openUrl(target, useInternalBrowser);
        }
        return true;
      }
      return false;
    },
  },
});
