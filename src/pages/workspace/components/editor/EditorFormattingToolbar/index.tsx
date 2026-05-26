import {
  useBlockNoteEditor,
  useSelectedBlocks,
  useEditorState,
  useExtension,
} from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextSelection } from "prosemirror-state";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import { useContextMenu } from "@/stores/useContextMenu";
import { useGlobalScrollActivity } from "@/hooks/useGlobalScrollActivity";
import { useFormattingToolbarAi } from "@/stores/useFormattingToolbarAi";
import { FormattingToolbarColorPicker } from "../FormattingToolbarColorPicker";
import { setFakeSelection } from "../fakeSelectionExtension";
import {
  NON_FORMATTABLE_TYPES,
  shouldRenderFormattingToolbar,
  useSelectionMarkStates,
} from "./helpers";
import type { BindTooltip } from "./ToolbarTooltip";
import { AiButton } from "./groups/AiButton";
import { MarkGroup } from "./groups/MarkGroup";
import { InlineGroup } from "./groups/InlineGroup";
import { LinkButton } from "./groups/LinkButton";
import { AlignGroup } from "./groups/AlignGroup";
import { ClearFormatButton } from "./groups/ClearFormatButton";
import { AiPanel } from "./AiPanel";

export { shouldRenderFormattingToolbar };

export function EditorFormattingToolbar() {
  const editor = useBlockNoteEditor();
  const aiExtension = useExtension(AIExtension);
  const markStates = useSelectionMarkStates(editor);
  const selectedBlocks = useSelectedBlocks();

  const selectionState = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;
      let blocks: Array<{ type?: string; props?: Record<string, unknown> }> =
        [];

      const $from = selection.$from;
      let inBlock = false;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "blockContainer") {
          inBlock = true;
          break;
        }
      }

      if (inBlock) {
        try {
          const selected = editor.getSelection();
          if (Array.isArray(selected?.blocks)) {
            blocks = selected.blocks;
          }
        } catch {
          blocks = [];
        }

        if (blocks.length === 0) {
          try {
            blocks = [editor.getTextCursorPosition().block];
          } catch {
            blocks = [];
          }
        }
      }

      const selectedText = doc
        .textBetween(selection.from, selection.to, "\n", "\n")
        .trim();
      const firstBlock = blocks[0];

      return {
        hasTextSelection: !selection.empty && selectedText.length > 0,
        hasNonFormattableBlock: blocks.some(
          (block) => !!block.type && NON_FORMATTABLE_TYPES.has(block.type),
        ),
        isTitleHeading:
          firstBlock?.type === "heading" &&
          (firstBlock.props as { level?: number } | undefined)?.level === 1,
      };
    },
  });

  const aiEnabled = useSettings((state) => state.ai.enabled);
  const aiActive = useFormattingToolbarAi((s) => s.active);
  const setAiActive = useFormattingToolbarAi((s) => s.setActive);

  const openMenuId = useContextMenu((state) => state.openMenuId);
  const isContextMenuOpen = Boolean(openMenuId);
  const scrollActivity = useGlobalScrollActivity({ idleMs: 120 });
  const isScrolling = scrollActivity.isScrolling;

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [aiContext, setAiContext] = useState<{
    selectedText: string;
    blockText: string;
    savedSelection: { from: number; to: number } | null;
  } | null>(null);

  const bindTooltip = useCallback<BindTooltip>(
    (id) => ({
      delayDuration: 0,
      open: activeTooltip === id,
      onOpenChange: (open) =>
        setActiveTooltip((prev) => (open ? id : prev === id ? null : prev)),
    }),
    [activeTooltip],
  );

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.zIndex = "20000";
  }, []);

  useEffect(() => {
    if (!isScrolling && !isContextMenuOpen) return;
    setActiveTooltip(null);
  }, [isScrolling, isContextMenuOpen]);

  // Clear AI mode + fake selection on unmount (e.g. when toolbar unmounts)
  useEffect(() => {
    return () => {
      if (savedSelectionRef.current) {
        try {
          setFakeSelection(editor, null);
        } catch {
          /* ignore */
        }
      }
      setAiActive(false);
    };
  }, [editor, setAiActive]);

  // xl-ai 接管：旧自家 AiPanel 不再触发，AI 按钮改为打开 xl-ai 的 AIMenu。
  // 保留 selection 保存逻辑（用于聚焦/退出还原），但跳过 setAiActive。
  const handleAiActivate = useCallback(() => {
    try {
      const { selection } = editor.prosemirrorState;
      if (selection.empty) return;
      const saved = { from: selection.from, to: selection.to };
      savedSelectionRef.current = saved;
      setFakeSelection(editor, saved);

      const blockId = editor.getTextCursorPosition().block.id;
      setActiveTooltip(null);
      aiExtension?.openAIMenuAtBlock(blockId);
    } catch {
      /* ignore */
    }
  }, [editor, aiExtension]);

  const handleAiClose = useCallback(() => {
    const savedSel = savedSelectionRef.current;
    try {
      setFakeSelection(editor, null);
    } catch {
      /* ignore */
    }
    savedSelectionRef.current = null;
    setAiContext(null);
    setAiActive(false);

    // 把 ProseMirror 选区恢复到原始范围并把焦点交还给 editor。
    // 否则点击空白后 editor 失焦：1) 选区高亮消失；2) Mod-z 快捷键
    // 进不到 ProseMirror，导致撤销整体失灵。
    if (savedSel) {
      requestAnimationFrame(() => {
        try {
          const view = (editor as any).prosemirrorView;
          if (!view) return;
          const { state } = view;
          const docSize = state.doc.content.size;
          const from = Math.min(savedSel.from, docSize);
          const to = Math.min(savedSel.to, docSize);
          if (from !== to) {
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, from, to),
            );
            tr.setMeta("addToHistory", false);
            view.dispatch(tr);
          }
          view.focus();
        } catch {
          /* ignore */
        }
      });
    }
  }, [editor, setAiActive]);

  const isBold = markStates.bold;
  const isItalic = markStates.italic;
  const isStrike = markStates.strike;
  const isUnderline = markStates.underline;
  const isCode = markStates.code;

  const firstBlock = selectedBlocks[0];
  const textAlignment =
    (firstBlock?.props as { textAlignment?: string } | undefined)
      ?.textAlignment ?? "left";

  const linkUrl = editor.getSelectedLinkUrl();
  const isLinkActive = !!linkUrl;

  const setTextAlignment = useCallback(
    (alignment: "left" | "center" | "right") => {
      for (const block of selectedBlocks) {
        editor.updateBlock(block, {
          props: { textAlignment: alignment },
        });
      }
    },
    [editor, selectedBlocks],
  );

  const clearFormatting = useCallback(() => {
    editor.removeStyles({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      code: true,
      textColor: true,
      backgroundColor: true,
    } as any);
    for (const block of selectedBlocks) {
      editor.updateBlock(block, {
        props: { textAlignment: "left" },
      });
    }
  }, [editor, selectedBlocks]);

  const shouldHideForScroll = isScrolling || isContextMenuOpen;
  // While AI is active we keep the toolbar visible regardless of scroll/menu.
  const shouldHide = !aiActive && shouldHideForScroll;

  // Selection-based gating only matters when AI mode isn't already active.
  if (
    !aiActive &&
    (!selectionState.hasTextSelection ||
      selectionState.hasNonFormattableBlock ||
      selectionState.isTitleHeading)
  ) {
    return null;
  }

  return (
    <TooltipProvider
      delayDuration={0}
      skipDelayDuration={0}
      disableHoverableContent
    >
      <div
        ref={menuRef}
        data-formatting-toolbar
        onMouseDown={(e) => {
          // Allow native focus on the AI textarea; everything else uses onClick.
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (target.tagName === "TEXTAREA" || target.tagName === "INPUT")
            return;
          if (target.isContentEditable) return;
          e.preventDefault();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "z-[20000] rounded-[10px] border border-border/75 bg-popover shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] transition-[opacity,transform,width] duration-150 ease-out dark:border-white/15 dark:bg-[#2f3437]",
          aiActive ? "w-[520px] max-w-[calc(100vw-24px)]" : "w-auto",
        )}
        style={{
          opacity: shouldHide ? 0 : 1,
          transform: shouldHide ? "scale(0.96)" : "scale(1)",
          pointerEvents: shouldHide ? "none" : "auto",
        }}
      >
        {aiActive && aiContext ? (
          <AiPanel
            editor={editor}
            savedSelection={aiContext.savedSelection}
            selectedText={aiContext.selectedText}
            blockText={aiContext.blockText}
            initialAction="polish"
            onClose={handleAiClose}
          />
        ) : (
          <div className="flex items-center gap-0.5 p-1">
            {aiEnabled && (
              <>
                <AiButton onActivate={handleAiActivate} bindTooltip={bindTooltip} />
                <Separator
                  orientation="vertical"
                  className="h-5 opacity-70 mx-0.5"
                />
              </>
            )}

            <MarkGroup
              isBold={isBold}
              isItalic={isItalic}
              isStrike={isStrike}
              bindTooltip={bindTooltip}
            />

            <FormattingToolbarColorPicker />

            <InlineGroup
              isUnderline={isUnderline}
              isCode={isCode}
              bindTooltip={bindTooltip}
            />

            <Separator orientation="vertical" className="h-5 opacity-70" />

            <LinkButton
              isLinkActive={isLinkActive}
              linkUrl={linkUrl}
              bindTooltip={bindTooltip}
            />

            <Separator orientation="vertical" className="h-5 opacity-70" />

            <AlignGroup
              textAlignment={textAlignment}
              setTextAlignment={setTextAlignment}
              bindTooltip={bindTooltip}
            />

            <Separator orientation="vertical" className="h-5 opacity-70" />

            <ClearFormatButton
              onClear={clearFormatting}
              bindTooltip={bindTooltip}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
