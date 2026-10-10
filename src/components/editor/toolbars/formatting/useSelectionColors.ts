import { useEditorState } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  getHeadingBackgroundSelectionState,
  getToolbarTargetBlocks,
} from "./headingBlockBackground";
import { MIXED } from "./colorPalette";

/**
 * Walks the current selection and returns the textColor / backgroundColor
 * marks across it. Returns `MIXED` if the selection spans more than one value.
 * BlockNote's useActiveStyles() only reads marks at selection.$to, so it
 * can't detect heterogeneous color selections — we scan the range ourselves.
 */
export function useSelectionColorState(editor: BlockNoteEditor<any, any, any>) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;
      const headingBackground = getHeadingBackgroundSelectionState(
        getToolbarTargetBlocks(editor),
      );
      const textColors = new Set<string>();
      const bgColors = new Set<string>();
      const from = selection.from;
      const to = selection.to;

      if (from === to) {
        const marks = selection.$to.marks();
        const tc = marks.find((m: any) => m.type.name === "textColor");
        const bc = marks.find((m: any) => m.type.name === "backgroundColor");
        return {
          textColor: (tc?.attrs.stringValue as string | undefined) ?? "default",
          backgroundColor: headingBackground.isHeadingSelection
            ? headingBackground.backgroundColor
            : ((bc?.attrs.stringValue as string | undefined) ?? "default"),
        };
      }

      doc.nodesBetween(from, to, (node: any) => {
        if (!node.isText) return true;
        const tc = node.marks.find((m: any) => m.type.name === "textColor");
        const bc = node.marks.find(
          (m: any) => m.type.name === "backgroundColor",
        );
        textColors.add(
          (tc?.attrs.stringValue as string | undefined) ?? "default",
        );
        bgColors.add(
          (bc?.attrs.stringValue as string | undefined) ?? "default",
        );
        return false;
      });

      return {
        textColor:
          textColors.size === 0
            ? "default"
            : textColors.size === 1
              ? [...textColors][0]
              : MIXED,
        backgroundColor: headingBackground.isHeadingSelection
          ? headingBackground.backgroundColor
          : bgColors.size === 0
            ? "default"
            : bgColors.size === 1
              ? [...bgColors][0]
              : MIXED,
      };
    },
  });
}
