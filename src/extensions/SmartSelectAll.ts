import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

function selectExcludingTitle(
  state: { tr: { setSelection: (arg0: TextSelection) => any } },
  doc: any,
  dispatch?: (arg0: any) => void,
) {
  const firstNode = doc.firstChild;
  if (
    firstNode &&
    firstNode.type.name === "heading" &&
    firstNode.attrs.level === 1
  ) {
    const titleEnd = firstNode.nodeSize;
    const docEnd = doc.content.size;
    if (dispatch) {
      const tr = state.tr.setSelection(
        TextSelection.create(doc, titleEnd, docEnd),
      );
      dispatch(tr);
    }
    return true;
  }
  return false;
}

export const SmartSelectAll = Extension.create({
  name: "smartSelectAll",

  addKeyboardShortcuts() {
    return {
      "Mod-a": () => {
        const { state, dispatch } = this.editor.view;
        const { selection, doc } = state;
        const { $from, $to } = selection;

        const firstNode = doc.firstChild;
        const isFirstNodeH1 =
          firstNode &&
          firstNode.type.name === "heading" &&
          firstNode.attrs.level === 1;
        const isInH1 =
          isFirstNodeH1 && $from.pos <= firstNode.nodeSize && $to.pos <= 1;

        // If selection spans multiple blocks, exclude H1 from selection
        if (!$from.sameParent($to)) {
          return selectExcludingTitle(state, doc, dispatch);
        }

        const parent = $from.parent;

        // If not a text block, let default handle
        if (!parent.isTextblock) {
          return false;
        }

        // Calculate the range of the parent content
        const parentPos = $from.start();
        const parentEnd = $from.end();

        // Check if current selection covers the entire parent
        const isParentSelected =
          $from.pos === parentPos && $to.pos === parentEnd;

        // If already selected entire paragraph or inside H1 that is fully selected
        if (isParentSelected) {
          // If inside H1 and H1 is fully selected, select everything after title
          if (isInH1) {
            return selectExcludingTitle(state, doc, dispatch);
          }
          // Otherwise select everything after title
          return selectExcludingTitle(state, doc, dispatch);
        }

        // Select the entire parent content
        if (dispatch) {
          const tr = state.tr.setSelection(
            TextSelection.create(doc, parentPos, parentEnd),
          );
          dispatch(tr);
        }
        return true;
      },
    };
  },
});
