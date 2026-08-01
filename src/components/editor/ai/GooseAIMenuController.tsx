import { useEffect, useMemo, useRef, type FC } from "react";
import {
  BlockPopover,
  PositionPopover,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
  type FloatingUIOptions,
} from "@blocknote/react";
import { autoUpdate, flip, offset, shift, size } from "@floating-ui/react";
import { getScaledEditorUiPx } from "@/components/editor/utils/editorContextUi";
import { AIExtension, AIMenu, type AIMenuProps } from "@blocknote/xl-ai";
import { TextSelection } from "prosemirror-state";
import { setFakeSelection } from "@/components/editor/extensions/fakeSelectionExtension";
import { useFormattingToolbarAi } from "@/components/editor/state/formattingToolbarAi";

type GooseAIMenuControllerProps = {
  aiMenu?: FC<AIMenuProps>;
};

/**
 * xl-ai 默认把菜单锚到整块并把浮层撑成块宽。格式栏入口需要锚到原文字选区，
 * 其它入口（空段落、斜杠菜单）则继续沿用块锚点。
 */
export function GooseAIMenuController({
  aiMenu: Component = AIMenu,
}: GooseAIMenuControllerProps) {
  const editor = useBlockNoteEditor();
  const ai = useExtension(AIExtension);
  const aiMenuState = useExtensionState(AIExtension, {
    editor,
    selector: (state) => state.aiMenuState,
  });
  const selection = useFormattingToolbarAi((state) => state.selection);
  const resetFormattingToolbarAi = useFormattingToolbarAi(
    (state) => state.reset,
  );
  const openedFromSelectionRef = useRef(false);

  const blockId = aiMenuState === "closed" ? undefined : aiMenuState.blockId;
  const open = aiMenuState !== "closed";

  useEffect(() => {
    if (open && selection) {
      openedFromSelectionRef.current = true;
      return;
    }
    if (open || !openedFromSelectionRef.current) return;

    openedFromSelectionRef.current = false;
    try {
      setFakeSelection(editor, null);
    } catch {
      /* 编辑器可能正随页面切换卸载。 */
    }
    resetFormattingToolbarAi();

    // xl-ai 关闭时会把焦点还给编辑器；下一帧恢复原范围，避免快捷键撤销
    // 落到页面而不是 ProseMirror。该事务不进入 undo history。
    if (selection) {
      requestAnimationFrame(() => {
        try {
          const view = editor.prosemirrorView;
          if (!view) return;
          const docSize = view.state.doc.content.size;
          const from = Math.min(selection.from, docSize);
          const to = Math.min(selection.to, docSize);
          if (from !== to) {
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, from, to),
            );
            tr.setMeta("addToHistory", false);
            view.dispatch(tr);
          }
          view.focus();
        } catch {
          /* 关闭期间文档或页面可能已经切换。 */
        }
      });
    }
  }, [editor, open, resetFormattingToolbarAi, selection]);

  useEffect(
    () => () => {
      try {
        setFakeSelection(editor, null);
      } catch {
        /* ignore */
      }
      resetFormattingToolbarAi();
    },
    [editor, resetFormattingToolbarAi],
  );

  const floatingUIOptions = useMemo<FloatingUIOptions>(() => {
    const selectionMiddleware = [
      offset(() => getScaledEditorUiPx(10)),
      flip({ fallbackPlacements: ["top-start"], padding: 8 }),
      shift({ padding: 8 }),
    ];
    const blockMiddleware = [
      offset(() => getScaledEditorUiPx(10)),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ];

    return {
      useFloatingOptions: {
        open,
        placement: selection ? "bottom-start" : "bottom",
        middleware: selection ? selectionMiddleware : blockMiddleware,
        onOpenChange: (nextOpen) => {
          if (nextOpen || aiMenuState === "closed") return;
          if (aiMenuState.status === "user-input") {
            ai.closeAIMenu();
          } else if (
            aiMenuState.status === "user-reviewing" ||
            aiMenuState.status === "error"
          ) {
            ai.rejectChanges();
          }
        },
        whileElementsMounted(reference, floating, update) {
          return autoUpdate(reference, floating, update, {
            animationFrame: true,
          });
        },
      },
      useDismissProps: {
        enabled:
          aiMenuState === "closed" || aiMenuState.status === "user-input",
        outsidePress: (event) => {
          if (event.target instanceof Element) {
            const blockElement = event.target.closest(".bn-block");
            if (
              blockElement &&
              blockElement.getAttribute("data-id") === blockId
            ) {
              ai.closeAIMenu();
            }
          }
          return true;
        },
      },
      elementProps: {
        className: "bn-root bn-mantine",
        style: { zIndex: 20010 },
      },
      focusManagerProps: {
        disabled: false,
        getInsideElements: () => (editor.domElement ? [editor.domElement] : []),
      },
    };
  }, [ai, aiMenuState, blockId, editor.domElement, open, selection]);

  // GenericPopover 的外层负责 viewport 定位；缩放只放在内层 surface，
  // 避免 CSS zoom 同时放大 Floating UI 计算出的 fixed 坐标。
  const content = open ? (
    <div className="goose-editor-context-ui bn-root bn-mantine">
      <Component />
    </div>
  ) : null;

  if (selection) {
    return (
      <PositionPopover
        position={selection}
        portalElement={null}
        {...floatingUIOptions}
      >
        {content}
      </PositionPopover>
    );
  }

  return (
    <BlockPopover blockId={blockId} portalElement={null} {...floatingUIOptions}>
      {content}
    </BlockPopover>
  );
}
