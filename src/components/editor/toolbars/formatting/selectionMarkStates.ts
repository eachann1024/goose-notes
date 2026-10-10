import { useEditorState } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";

export const BOOLEAN_MARK_NAMES = [
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
] as const;
export type BooleanMarkName = (typeof BOOLEAN_MARK_NAMES)[number];

/**
 * Walk the selection so partial-coverage marks register as inactive.
 * BlockNote's useActiveStyles() only inspects selection.$to which misses ranges.
 */
export function useSelectionMarkStates(editor: BlockNoteEditor<any, any, any>) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;
      const from = selection.from;
      const to = selection.to;

      const result: Record<BooleanMarkName, boolean> = {
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
      };

      if (from === to) {
        const marks = selection.$to.marks();
        for (const name of BOOLEAN_MARK_NAMES) {
          result[name] = marks.some((m: any) => m.type.name === name);
        }
        return result;
      }

      const counts: Record<BooleanMarkName, { with: number; total: number }> = {
        bold: { with: 0, total: 0 },
        italic: { with: 0, total: 0 },
        strike: { with: 0, total: 0 },
        underline: { with: 0, total: 0 },
        code: { with: 0, total: 0 },
      };

      doc.nodesBetween(from, to, (node: any) => {
        if (!node.isText) return true;
        for (const name of BOOLEAN_MARK_NAMES) {
          counts[name].total += 1;
          if (node.marks.some((m: any) => m.type.name === name)) {
            counts[name].with += 1;
          }
        }
        return false;
      });

      for (const name of BOOLEAN_MARK_NAMES) {
        result[name] =
          counts[name].total > 0 && counts[name].with === counts[name].total;
      }
      return result;
    },
  });
}
