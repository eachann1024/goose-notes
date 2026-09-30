import { createExtension } from "@blocknote/core";
import {
  addRowAfter,
  goToNextCell,
  isInTable,
} from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";

const NESTABLE_BLOCK_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

const handleTableTab = (view: EditorView, direction: 1 | -1): boolean => {
  if (!isInTable(view.state)) return false;

  if (goToNextCell(direction)(view.state, view.dispatch)) {
    view.focus();
    return true;
  }

  // 末尾单元格：先新增一行，再跳到下一格
  if (direction === 1 && addRowAfter(view.state, view.dispatch)) {
    goToNextCell(1)(view.state, view.dispatch);
    view.focus();
    return true;
  }

  return true;
};

export const gooseTabBehaviorExtension = createExtension({
  key: "goose-tab-behavior",
  keyboardShortcuts: {
    Tab: ({ editor }) => {
      const view = editor.prosemirrorView;
      if (view && handleTableTab(view, 1)) {
        return true;
      }
      const cursor = editor.getTextCursorPosition();
      if (NESTABLE_BLOCK_TYPES.has(cursor.block.type)) {
        return false;
      }
      return true;
    },
    "Shift-Tab": ({ editor }) => {
      const view = editor.prosemirrorView;
      if (view && handleTableTab(view, -1)) {
        return true;
      }
      const cursor = editor.getTextCursorPosition();
      if (NESTABLE_BLOCK_TYPES.has(cursor.block.type)) {
        return false;
      }
      return true;
    },
  },
});
