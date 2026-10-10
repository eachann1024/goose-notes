import { useEffect, useMemo, useRef, useState } from "react";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import {
  useEditorState,
  useExtensionState,
  type FloatingUIOptions,
} from "@blocknote/react";
import {
  autoUpdate as floatingAutoUpdate,
  flip as floatingFlip,
  offset as floatingOffset,
  shift as floatingShift,
  size as floatingSize,
  type Middleware,
} from "@floating-ui/react";
import { shouldRenderFormattingToolbar } from "@/components/editor/toolbars/formatting";
import {
  getFormattingSelectionMode,
  isFormattingToolbarOpen,
} from "@/components/editor/toolbars/formatting/helpers";
import { useFormattingToolbarAi } from "@/components/editor/state/formattingToolbarAi";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { findNonOverlappingToolbarPosition } from "@/components/editor/utils/formattingToolbarPosition";
import { getMultiBlockToolbarEdgeRect } from "@/components/editor/utils/formattingToolbarReference";
import {
  EDITOR_CONTEXT_UI_GAP,
  getScaledEditorUiPx,
} from "@/components/editor/utils/editorContextUi";
import type { EditorComposerProps } from "./editorComposerTypes";

function getFormattingToolbarGap(): number {
  return getScaledEditorUiPx(EDITOR_CONTEXT_UI_GAP);
}

export function useEditorComposerToolbar(
  {
    editor,
    editable,
    editorContainerRef,
    suppressFormattingToolbar = false,
  }: Pick<
    EditorComposerProps,
    "editor" | "editable" | "editorContainerRef" | "suppressFormattingToolbar"
  >,
  setLinkPopoverOpen: (open: boolean) => void,
) {
  const formattingToolbarStoreOpen = useExtensionState(
    FormattingToolbarExtension,
    { editor },
  );
  const formattingToolbarSelectionAllowed = useEditorState({
    editor,
    on: "selection",
    selector: ({ editor }) => shouldRenderFormattingToolbar(editor),
  });
  const formattingToolbarAiActive = useFormattingToolbarAi(
    (s) => s.active && s.owner === editor,
  );
  const resetFormattingToolbarAi = useFormattingToolbarAi((s) => s.reset);
  const [holdFormattingToolbar, setHoldFormattingToolbar] = useState(false);
  const holdFormattingToolbarRef = useRef(false);
  const toolbarOpenForHoldRef = useRef(false);
  useEffect(() => {
    if (!editable) {
      setLinkPopoverOpen(false);
      resetFormattingToolbarAi(editor);
    }
  }, [editable, editor, resetFormattingToolbarAi]);

  const formattingToolbarOpen = isFormattingToolbarOpen({
    editable,
    suppress: suppressFormattingToolbar,
    aiActive: formattingToolbarAiActive,
    storeOpen: formattingToolbarStoreOpen,
    selectionAllowed: formattingToolbarSelectionAllowed,
    holdDuringPointerSelect: holdFormattingToolbar,
  });
  toolbarOpenForHoldRef.current = formattingToolbarOpen;

  // BlockNote 在 editor pointerdown 时关掉格式栏，pointerup 才按选区恢复。
  // 已有选区再拖选另一行时按住工具栏，避免挡住的上一行闪一下。
  useEffect(() => {
    const dom = editor.domElement;
    if (!dom) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (holdFormattingToolbarRef.current) return;
      if (!toolbarOpenForHoldRef.current) return;
      holdFormattingToolbarRef.current = true;
      setHoldFormattingToolbar(true);
    };
    const endHold = () => {
      if (!holdFormattingToolbarRef.current) return;
      holdFormattingToolbarRef.current = false;
      setHoldFormattingToolbar(false);
    };

    dom.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", endHold);
    window.addEventListener("pointercancel", endHold);
    window.addEventListener("blur", endHold);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", endHold);
      window.removeEventListener("pointercancel", endHold);
      window.removeEventListener("blur", endHold);
      if (!holdFormattingToolbarRef.current) return;
      holdFormattingToolbarRef.current = false;
      setHoldFormattingToolbar(false);
    };
  }, [editor, editor.domElement]);

  const formattingToolbarFloatingOptions = useMemo<FloatingUIOptions>(() => {
    const boundary = editorContainerRef.current ?? undefined;
    const overflowOptions = { boundary, padding: 8 };
    const avoidSelectionOverlap: Middleware = {
      name: "gooseAvoidSelectionOverlap",
      fn({ placement, rects, elements }) {
        const editorRect = editorContainerRef.current?.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const padding = 8;
        const left = Math.max(padding, editorRect?.left ?? padding);
        const top = Math.max(padding, editorRect?.top ?? padding);
        const right = Math.min(
          viewportWidth - padding,
          editorRect?.right ?? viewportWidth - padding,
        );
        const bottom = Math.min(
          viewportHeight - padding,
          editorRect?.bottom ?? viewportHeight - padding,
        );
        const preferredSide = placement.split("-")[0] as
          | "top"
          | "bottom"
          | "left"
          | "right";
        let reference = {
          top: rects.reference.y,
          right: rects.reference.x + rects.reference.width,
          bottom: rects.reference.y + rects.reference.height,
          left: rects.reference.x,
          width: rects.reference.width,
          height: rects.reference.height,
        };
        // Multi-block spans are tall: collapse to a thin top/bottom edge so the
        // toolbar can sit above/below the full selection instead of being forced
        // sideways or hidden by avoid-overlap treating the whole bbox as forbidden.
        if (getFormattingSelectionMode(editor) === "multiBlock") {
          reference = getMultiBlockToolbarEdgeRect(reference, preferredSide);
        }
        const next = findNonOverlappingToolbarPosition({
          reference,
          floating: rects.floating,
          boundary: {
            top,
            right,
            bottom,
            left,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top),
          },
          preferredSide,
          // 工具栏没有外投影，只保留紧凑的视觉分隔；偏移随编辑器 UI 等比缩放。
          gap: getFormattingToolbarGap(),
        });

        if (!next) {
          elements.floating.style.visibility = "hidden";
          elements.floating.style.pointerEvents = "none";
          return {};
        }
        elements.floating.style.visibility = "visible";
        elements.floating.style.pointerEvents = "auto";
        return next;
      },
    };

    return {
      useFloatingOptions: {
        open: formattingToolbarOpen,
        strategy: "fixed" as const,
        // 优先完整选区上方、水平居中；上方空间不足再翻到下方。
        // 边界取编辑器与视口的交集，避免靠边选区溢出。
        placement: "top" as const,
        middleware: [
          floatingOffset(() => getFormattingToolbarGap()),
          floatingFlip({
            ...overflowOptions,
            fallbackPlacements: ["bottom"],
          }),
          floatingShift(overflowOptions),
          floatingSize({
            ...overflowOptions,
            apply({ availableWidth, elements }) {
              // 极窄窗口或高缩放下允许工具栏横向滚动，所有操作仍可访问。
              // 工具栏直接使用缩放后的布局尺寸，Floating UI 与
              // 按钮 DOMRect 共用同一套 viewport 坐标，无需再换算 CSS zoom。
              // 旧 Electron 内核会把带 overflow 的浮层与圆角子元素合成出直角灰块。
              const safeAvailableWidth = Math.max(0, availableWidth);
              elements.floating.style.maxWidth = `${safeAvailableWidth}px`;
              elements.floating.style.overflowX = "visible";
              const toolbar = elements.floating.querySelector<HTMLElement>(
                "[data-formatting-toolbar]",
              );
              if (toolbar) {
                toolbar.style.maxWidth = `${safeAvailableWidth}px`;
              }
            },
          }),
          // 最后一层硬约束：工具栏必须完整留在编辑区/视口交集内，且不与
          // 完整选区相交；覆盖 Windows 旧内核的多行选区坐标差异。
          avoidSelectionOverlap,
        ],
        // 选区是虚拟锚点。段落对齐等事务会改变其 DOM 几何，却不会改变
        // ProseMirror 的 from/to；逐帧检测可在同一帧布局完成后立即刷新位置。
        // 同时覆盖滚动、缩放、窗口变化和工具栏自身尺寸变化。
        whileElementsMounted(reference, floating, update) {
          const cleanup = floatingAutoUpdate(reference, floating, update, {
            animationFrame: true,
          });
          window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
          return () => {
            window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
            cleanup();
          };
        },
      },
    };
  }, [editor, editorContainerRef, formattingToolbarOpen]);

  return {
    formattingToolbarOpen,
    formattingToolbarFloatingOptions,
    holdFormattingToolbar,
  };
}
