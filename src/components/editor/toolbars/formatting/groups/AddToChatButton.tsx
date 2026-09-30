import { Kbd } from "@/components/editor/ui/kbd";
import {
  SELECTION_QUOTE_ADD_SHORTCUT,
  dispatchAppendComposerSelection,
} from "@/components/editor/ai/composer/selectionQuote";

export function AddToChatButton({
  selectedText,
  pageId,
  pageTitle,
}: {
  selectedText: string;
  pageId: string;
  pageTitle: string;
}) {
  return (
    <button
      type="button"
      className="goose-formatting-toolbar-add-to-chat"
      aria-label="将选区加入对话"
      aria-keyshortcuts="Control+Shift+U Meta+Shift+U"
      onClick={() => {
        dispatchAppendComposerSelection({
          pageId,
          pageTitle,
          text: selectedText,
          animate: true,
        });
      }}
    >
      <span className="goose-formatting-toolbar-add-to-chat-label">
        加入对话
      </span>
      <Kbd
        shortcut={SELECTION_QUOTE_ADD_SHORTCUT}
        className="goose-formatting-toolbar-add-to-chat-kbd"
      />
    </button>
  );
}
