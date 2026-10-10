import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { createExtension } from "@blocknote/core";
import { Fragment } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import { indentCodeSelection } from "./codeBlockIndent";
import { getCodeDomSelection } from "./codeDomSelection";

function codeTextToInlineFragment(schema: any, text: string) {
  if (!text) return Fragment.empty;
  const hardBreakType = schema.nodes.hardBreak;
  const nodes: any[] = [];

  text.split("\n").forEach((line, index) => {
    if (index > 0 && hardBreakType) nodes.push(hardBreakType.create());
    if (line) nodes.push(schema.text(line));
  });

  return nodes.length > 0 ? Fragment.fromArray(nodes) : Fragment.empty;
}
function findCodeBlockDepth($pos: any) {
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if ($pos.node(depth)?.type?.name === "codeBlock") return depth;
  }
  return null;
}

function applyCodeBlockIndentTransaction(tr: any, outdent: boolean) {
  const { $from, $to } = tr.selection;
  const fromCodeDepth = findCodeBlockDepth($from);
  const toCodeDepth = findCodeBlockDepth($to);
  if (
    fromCodeDepth == null ||
    toCodeDepth == null ||
    $from.before(fromCodeDepth) !== $to.before(toCodeDepth)
  ) {
    return false;
  }

  const codeBlockNode = $from.node(fromCodeDepth);
  const contentStart = $from.start(fromCodeDepth);
  const domSelection = getCodeDomSelection();
  const currentText =
    domSelection?.text ??
    codeBlockNode.textBetween(0, codeBlockNode.content.size, "\n", "\n");
  const selectionStart = domSelection?.start ?? $from.pos - contentStart;
  const selectionEnd = domSelection?.end ?? $to.pos - contentStart;
  const next = indentCodeSelection(currentText, selectionStart, selectionEnd, {
    outdent,
  });
  const replacement = codeTextToInlineFragment(tr.doc.type.schema, next.text);

  tr.replaceWith(
    contentStart,
    contentStart + codeBlockNode.content.size,
    replacement,
  );
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      contentStart + next.selectionStart,
      contentStart + next.selectionEnd,
    ),
  );
  return true;
}

export const codeBlockTabIndentExtension = createExtension(({ editor }) => ({
  key: "goose-code-block-tab-indent",
  runsBefore: ["code-block-keyboard-shortcuts"],
  mount: ({ dom, root, signal }) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isWorkspaceSettingsOpen()) return;
      if (event.key !== "Tab" || event.isComposing) return;
      const domSelection = getCodeDomSelection();
      if (!domSelection) return;
      const { block } = editor.getTextCursorPosition();
      if (block.type !== "codeBlock") return;

      const next = indentCodeSelection(
        domSelection.text,
        domSelection.start,
        domSelection.end,
        {
          outdent: event.shiftKey,
        },
      );
      editor.updateBlock(block.id, { content: next.text } as any);

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const target = root instanceof Document ? root : dom.ownerDocument;
    target.addEventListener("keydown", handleKeyDown, {
      capture: true,
      signal,
    });
  },
  keyboardShortcuts: {
    Tab: ({ editor }) =>
      editor.transact((tr) => applyCodeBlockIndentTransaction(tr, false)),
    "Shift-Tab": ({ editor }) =>
      editor.transact((tr) => applyCodeBlockIndentTransaction(tr, true)),
  },
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (event.key !== "Tab" || event.isComposing || !view.editable) {
            return false;
          }

          const { state, dispatch } = view;
          const tr = state.tr;
          if (!applyCodeBlockIndentTransaction(tr, event.shiftKey)) {
            return false;
          }

          event.preventDefault();
          dispatch(tr);
          return true;
        },
      },
    }),
  ],
}))();
