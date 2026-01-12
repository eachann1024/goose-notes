import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewRenderer } from "@tiptap/core";

export const SelectableHorizontalRule = HorizontalRule.extend({
  addNodeView(): NodeViewRenderer {
    return ({ editor, getPos }) => {
      const container = document.createElement("div");
      container.className = "horizontal-rule-wrapper";
      container.contentEditable = "false";

      const hr = document.createElement("hr");
      container.appendChild(hr);

      // Make the container clickable to select the node
      container.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (typeof getPos === "function") {
          const pos = getPos();
          if (typeof pos === "number") {
            const { tr } = editor.state;
            const nodeSelection = NodeSelection.create(editor.state.doc, pos);
            editor.view.dispatch(tr.setSelection(nodeSelection));
            editor.view.focus();
          }
        }
      });

      return {
        dom: container,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Backspace: () => {
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === "horizontalRule") {
          return this.editor.commands.deleteSelection();
        }
        return false;
      },
      Delete: () => {
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === "horizontalRule") {
          return this.editor.commands.deleteSelection();
        }
        return false;
      },
    };
  },
});
