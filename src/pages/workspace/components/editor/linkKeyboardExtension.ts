import { createExtension } from "@blocknote/core";
import { openExternalUrl } from "@/lib/openExternalUrl";

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
        openExternalUrl(url);
        return true;
      }
      return false;
    },
  },
});
