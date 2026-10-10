import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";
import {
  writeSelectionClipboard,
  deleteCutSelection,
} from "./copyBlockClipboard";
export {
  GOOSE_BLOCKNOTE_BLOCK_COPY_MIME,
  normalizeBlockNoteClipboardHtml,
} from "./copyBlockClipboard";
export {
  getCurrentBlockNodeSelection,
  STRUCTURED_COPY_CONTENT_TYPES,
  shouldCopyClipboardWithFormatting,
  resolveCopyBlockSelection,
} from "./copyBlockSelection";
const PLUGIN_KEY = new PluginKey("goose-copy-current-block");

export const gooseCopyCurrentBlockExtension = createExtension({
  key: "goose-copy-current-block",
  prosemirrorPlugins: [
    new Plugin({
      key: PLUGIN_KEY,
      props: {
        handleDOMEvents: {
          copy(view, event) {
            return writeSelectionClipboard(view, event);
          },
          cut(view, event) {
            if (view.state.selection.empty) return false;
            if (!writeSelectionClipboard(view, event)) return false;
            deleteCutSelection(view);
            return true;
          },
        },
      },
    }),
  ],
});
