import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AiPanel } from "./EditorFormattingToolbar/AiPanel";
import { setFakeSelection } from "./fakeSelectionExtension";
import type { BlockNoteEditor } from "@blocknote/core";

const POPOVER_WIDTH = 520;
const POPOVER_HEIGHT_ESTIMATE = 96;

interface OpenState {
  editor: BlockNoteEditor<any, any, any>;
  savedSelection: { from: number; to: number } | null;
  selectedText: string;
  blockText: string;
  initialAction: "polish" | "rewrite" | "generate";
  position: { x: number; y: number };
}

function computePosition(
  editor: BlockNoteEditor<any, any, any>,
  width: number,
  overrideRect?: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number },
) {
  let px = 0;
  let py = 0;

  if (overrideRect) {
    px = overrideRect.left + overrideRect.width / 2 - width / 2;
    py = overrideRect.top - POPOVER_HEIGHT_ESTIMATE - 8;
    if (py < 10) py = overrideRect.bottom + 8;
  } else {
    const domSelection = window.getSelection();
    let textRect: DOMRect | null = null;
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      if (!range.collapsed) textRect = range.getBoundingClientRect();
    }

    if (textRect && textRect.width > 0) {
      px = textRect.left + textRect.width / 2 - width / 2;
      py = textRect.top - POPOVER_HEIGHT_ESTIMATE - 8;
      if (py < 10) py = textRect.bottom + 8;
    } else {
      let targetBlock = editor.getTextCursorPosition().block;
      const editorSelection = editor.getSelection();
      if (editorSelection && editorSelection.blocks.length > 0) {
        targetBlock = editorSelection.blocks[0];
      }
      const blockEl = document.querySelector(
        `[data-id="${targetBlock.id}"]`,
      ) as HTMLElement | null;
      if (blockEl) {
        const rect = blockEl.getBoundingClientRect();
        px = rect.left + rect.width / 2 - width / 2;
        py = rect.top - POPOVER_HEIGHT_ESTIMATE - 8;
        if (py < 10) py = rect.bottom + 8;
      } else {
        px = window.innerWidth / 2 - width / 2;
        py = window.innerHeight / 2 - POPOVER_HEIGHT_ESTIMATE / 2;
      }
    }
  }

  px = Math.max(12, Math.min(px, window.innerWidth - width - 12));
  py = Math.max(12, Math.min(py, window.innerHeight - POPOVER_HEIGHT_ESTIMATE - 12));
  return { x: px, y: py };
}

export function AiInlineInput() {
  const [state, setState] = useState<OpenState | null>(null);
  const stateRef = useRef<OpenState | null>(null);
  stateRef.current = state;

  const closePanel = useCallback(() => {
    const current = stateRef.current;
    if (current) {
      try {
        setFakeSelection(current.editor, null);
      } catch {
        /* ignore */
      }
    }
    setState(null);
  }, []);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{
        editor: BlockNoteEditor<any, any, any>;
        initialAction?: "polish" | "rewrite" | "generate";
        overrideRect?: DOMRect;
      }>;

      const editor = customEvent.detail?.editor;
      if (!editor) return;

      const position = computePosition(
        editor,
        POPOVER_WIDTH,
        customEvent.detail?.overrideRect,
      );

      let selText = "";
      try {
        selText = editor.getSelectedText() || "";
      } catch {
        /* ignore */
      }

      let blkText = "";
      try {
        const block = editor.getTextCursorPosition().block;
        const blockEl = document.querySelector(`[data-id="${block.id}"]`);
        blkText = blockEl?.textContent ?? "";
      } catch {
        /* ignore */
      }

      let savedSelection: { from: number; to: number } | null = null;
      try {
        const { selection } = editor.prosemirrorState;
        if (!selection.empty) {
          savedSelection = { from: selection.from, to: selection.to };
          setFakeSelection(editor, savedSelection);
        }
      } catch {
        /* ignore */
      }

      setState({
        editor,
        savedSelection,
        selectedText: selText,
        blockText: blkText,
        initialAction: customEvent.detail?.initialAction || "generate",
        position,
      });
    };

    document.addEventListener("open-ai-input-popover", handleOpen);
    return () =>
      document.removeEventListener("open-ai-input-popover", handleOpen);
  }, []);

  if (!state) return null;

  return createPortal(
    <div
      data-ai-inline-input
      className={cn(
        "fixed z-[20005] overflow-hidden rounded-xl border border-border/70 bg-popover shadow-[0_12px_32px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#2f3437]",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        left: state.position.x,
        top: state.position.y,
        width: POPOVER_WIDTH,
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
        if (target.isContentEditable) return;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <AiPanel
        editor={state.editor}
        savedSelection={state.savedSelection}
        selectedText={state.selectedText}
        blockText={state.blockText}
        initialAction={state.initialAction}
        onClose={closePanel}
      />
    </div>,
    document.body,
  );
}
