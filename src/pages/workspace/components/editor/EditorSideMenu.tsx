import { useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";
import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditorSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>();
  const suggestionMenu = useExtension(SuggestionMenu);
  const sideMenu = useExtension(SideMenuExtension);

  const state = useExtensionState(SideMenuExtension, {
    selector: (s) =>
      s !== undefined
        ? {
            show: s.show,
            block: s.block,
            referencePos: s.referencePos,
          }
        : undefined,
  });

  const block = state?.block;

  const handleAdd = useCallback(() => {
    if (!block) return;
    const content = block.content;
    const isEmpty =
      content !== undefined && Array.isArray(content) && content.length === 0;
    if (isEmpty) {
      editor.setTextCursorPosition(block);
      suggestionMenu?.openSuggestionMenu("/");
    } else {
      const [inserted] = editor.insertBlocks(
        [{ type: "paragraph" }],
        block,
        "after",
      );
      editor.setTextCursorPosition(inserted);
      suggestionMenu?.openSuggestionMenu("/");
    }
  }, [block, editor, suggestionMenu]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!block || !sideMenu) return;
      sideMenu.blockDragStart(
        { dataTransfer: e.dataTransfer, clientY: e.clientY },
        block,
      );
    },
    [block, sideMenu],
  );

  const handleDragEnd = useCallback(() => {
    sideMenu?.blockDragEnd?.();
  }, [sideMenu]);

  if (!state?.show || !state.referencePos) return null;

  if (block && block.id === editor.document[0]?.id) return null;

  const sideMenuWidth = 52;
  const top =
    state.referencePos.top + state.referencePos.height / 2 - 12;
  const left = Math.max(4, state.referencePos.left - sideMenuWidth - 4);

  return createPortal(
    <div
      className="fixed z-[30] flex items-center gap-0.5 rounded-lg px-1 py-0.5"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50",
          "transition-colors hover:bg-muted hover:text-foreground",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-muted-foreground/40",
          "transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing",
        )}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  );
}
