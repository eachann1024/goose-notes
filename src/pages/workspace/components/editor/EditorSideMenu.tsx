import { useCallback, useRef } from "react";
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
  const lastPosRef = useRef({ top: 0, left: 0 });

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
  const isVisible =
    !!state?.show &&
    !!state.referencePos &&
    !(block && block.id === editor.document[0]?.id);

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
        "before",
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

  if (state?.referencePos) {
    const sideMenuWidth = 40;
    // BlockNote 为 heading 设置了 padding-top:18px，底部仅 3px，
    // 导致几何中心比文字视觉中心偏高 (18-3)/2 = 7.5px，需补偿。
    const headingOffset = block?.type === "heading" ? 7.5 : 0;
    lastPosRef.current = {
      top: state.referencePos.top + state.referencePos.height / 2 + headingOffset,
      left: Math.max(4, state.referencePos.left - sideMenuWidth),
    };
  }

  const { top, left } = lastPosRef.current;

  return createPortal(
    <div
      className="fixed z-[60] flex items-center rounded-lg p-1 transition-[opacity,transform] duration-150 ease-out"
      style={{
        top,
        left,
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translateY(-50%) scale(1)"
          : "translateY(-50%) scale(0.92)",
        pointerEvents: isVisible ? "auto" : "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "flex h-6 w-5 items-center justify-center rounded-md text-muted-foreground/50",
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
          "flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-muted-foreground/40",
          "transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing",
        )}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  );
}
