import { createExtension } from "@blocknote/core";

const NESTABLE_BLOCK_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

export const gooseTabBehaviorExtension = createExtension({
  key: "goose-tab-behavior",
  keyboardShortcuts: {
    Tab: ({ editor }) => {
      const cursor = editor.getTextCursorPosition();
      if (NESTABLE_BLOCK_TYPES.has(cursor.block.type)) {
        return false;
      }
      return true;
    },
    "Shift-Tab": ({ editor }) => {
      const cursor = editor.getTextCursorPosition();
      if (NESTABLE_BLOCK_TYPES.has(cursor.block.type)) {
        return false;
      }
      return true;
    },
  },
});
