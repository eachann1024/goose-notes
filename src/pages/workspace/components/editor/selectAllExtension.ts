import { createExtension } from "@blocknote/core";
import { AllSelection, NodeSelection, TextSelection } from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";

const findAncestorDepthByTableRole = ($pos: any, roles: string[]) => {
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const tableRole = $pos.node(depth).type.spec?.tableRole;
    if (tableRole && roles.includes(tableRole)) {
      return depth;
    }
  }
  return -1;
};

export const gooseSelectAllExtension = createExtension({
  key: "goose-select-all",
  keyboardShortcuts: {
    "Mod-a": ({ editor }) => {
      const state = editor.prosemirrorState;
      const selection = state.selection;

      const $from = selection.$from;
      let blockContainerDepth = -1;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "blockContainer") {
          blockContainerDepth = d;
          break;
        }
      }

      if (blockContainerDepth < 0) {
        return false;
      }

      const cellDepth = findAncestorDepthByTableRole($from, ["cell", "header_cell"]);
      if (cellDepth >= 0) {
        const cellPos = $from.before(cellDepth);
        const blockPos = $from.before(blockContainerDepth);
        const cellStart = $from.start(cellDepth);
        const cellEnd = $from.end(cellDepth);
        const isCellTextFullySelected =
          selection instanceof TextSelection &&
          selection.from <= cellStart &&
          selection.to >= cellEnd;
        const isSingleCellSelection =
          selection instanceof CellSelection &&
          selection.$anchorCell.pos === cellPos &&
          selection.$headCell.pos === cellPos;
        const isTableBlockSelected =
          selection instanceof NodeSelection && selection.from === blockPos;

        if (isTableBlockSelected || selection instanceof AllSelection) {
          const allSel = new AllSelection(state.doc);
          editor.prosemirrorView.dispatch(state.tr.setSelection(allSel));
          return true;
        }

        if (isCellTextFullySelected || selection instanceof CellSelection) {
          const nodeSel = NodeSelection.create(state.doc, blockPos);
          editor.prosemirrorView.dispatch(state.tr.setSelection(nodeSel));
          return true;
        }

        if (!isSingleCellSelection) {
          const cellSel = CellSelection.create(state.doc, cellPos);
          editor.prosemirrorView.dispatch(state.tr.setSelection(cellSel));
          return true;
        }
      }

      const blockContentDepth = blockContainerDepth + 1;
      const blockContentNode =
        blockContentDepth <= $from.depth ? $from.node(blockContentDepth) : null;
      const isCodeBlock =
        blockContentNode?.type?.name === "codeBlock" ||
        (blockContentNode?.attrs as { type?: string } | undefined)?.type ===
          "codeBlock";

      if (isCodeBlock) {
        const codeStart = $from.start(blockContentDepth);
        const codeEnd = $from.end(blockContentDepth);
        const isCodeFullySelected =
          selection instanceof TextSelection &&
          selection.from <= codeStart &&
          selection.to >= codeEnd;

        if (isCodeFullySelected || selection instanceof AllSelection) {
          const allSel = new AllSelection(state.doc);
          editor.prosemirrorView.dispatch(state.tr.setSelection(allSel));
          return true;
        }

        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, codeStart, codeEnd),
        );
        editor.prosemirrorView.dispatch(tr);
        return true;
      }

      const blockStart = $from.start(blockContainerDepth);
      const blockEnd = $from.end(blockContainerDepth);

      let isBlockFullySelected = false;

      if (selection instanceof AllSelection) {
        isBlockFullySelected = true;
      } else if (selection instanceof NodeSelection) {
        const blockPos = $from.before(blockContainerDepth);
        isBlockFullySelected = selection.from === blockPos;
      } else if (selection instanceof TextSelection) {
        isBlockFullySelected =
          selection.from <= blockStart && selection.to >= blockEnd;
      }

      if (isBlockFullySelected) {
        const allSel = new AllSelection(state.doc);
        editor.prosemirrorView.dispatch(state.tr.setSelection(allSel));
        return true;
      }

      const tr = state.tr;
      if (blockStart === blockEnd) {
        const blockPos = $from.before(blockContainerDepth);
        const nodeSel = NodeSelection.create(state.doc, blockPos);
        tr.setSelection(nodeSel);
      } else {
        const textSel = TextSelection.create(state.doc, blockStart, blockEnd);
        tr.setSelection(textSel);
      }
      editor.prosemirrorView.dispatch(tr);
      return true;
    },
  },
});
