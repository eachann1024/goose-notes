import { createExtension } from "@blocknote/core";
import { deleteSelectedBlocks } from "./crossBlockDeleteActions";
import {
  deleteEmptyInlineLineBackward,
  deleteEmptyLineBackward,
  preventForwardDeleteIntoStructureBlock,
} from "./emptyLineDelete";
export * from "./crossBlockSelection";
export * from "./crossBlockDeleteActions";
export * from "./emptyLineDelete";

export const gooseCrossBlockDeleteExtension = createExtension({
  key: "goose-cross-block-delete",
  keyboardShortcuts: {
    Backspace: ({ editor }) => {
      return (
        deleteSelectedBlocks(editor) ||
        deleteEmptyInlineLineBackward(editor) ||
        (["paragraph", "codeBlock"].includes(
          editor.prosemirrorState.selection.$from.parent.type.name,
        ) &&
          deleteEmptyLineBackward(editor))
      );
    },
    Delete: ({ editor }) => {
      return (
        deleteSelectedBlocks(editor) ||
        deleteEmptyInlineLineBackward(editor) ||
        deleteEmptyLineBackward(editor) ||
        preventForwardDeleteIntoStructureBlock(editor)
      );
    },
  },
});
