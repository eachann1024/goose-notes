import { useEffect, useMemo, useRef, useState, type FC } from "react";
import {
  BlockPopover,
  PositionPopover,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
  type FloatingUIOptions,
} from "@blocknote/react";
import { autoUpdate, flip, offset, shift, size } from "@floating-ui/react";
import { GooseAIExtension } from "./GooseAIExtension";
import { GooseAIMenu } from "./GooseAIMenu";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import {
  AI_MENU_VIEWPORT_PAD_PX,
  computeAiMenuFloatingWidth,
} from "@/components/editor/ai/aiMenuFloatingWidth";
import { setFakeSelection } from "@/components/editor/extensions/fakeSelectionExtension";
import { isEmptyParagraphBlock } from "./emptyParagraphAiShortcut";
import { useFormattingToolbarAi } from "@/components/editor/state/formattingToolbarAi";
import {
  getEditorUiScale,
  getScaledEditorUiPx,
} from "@/components/editor/utils/editorContextUi";
import "@/pages/workspace/styles/editor-ai-menu.css";
import "./inlinePreview.css";

type GooseAIMenuControllerProps = {
  aiMenu?: FC;
};

type BnColorScheme = "light" | "dark";

/** 浮层 bn-root 需带 data-color-scheme，BlockNote 才会切到深色菜单变量。 */
function resolveBnColorScheme(
  editorDom: HTMLElement | null | undefined,
): BnColorScheme {
  const fromEditor = editorDom
    ?.closest(".bn-root")
    ?.getAttribute("data-color-scheme");
  if (fromEditor === "dark" || fromEditor === "light") return fromEditor;
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * 格式栏入口锚到原文字选区，
 * 其它入口（空段落、斜杠菜单）则继续沿用块锚点。
 */
export function GooseAIMenuController({
  aiMenu: Component = GooseAIMenu,
}: GooseAIMenuControllerProps) {
  const editor = useBlockNoteEditor();
  const { page } = useEditorPageContext();
  const ai = useExtension(GooseAIExtension);
  const aiMenuState = useExtensionState(GooseAIExtension, {
    editor,
    selector: (state) => state.aiMenuState,
  });
  const selection = aiMenuState === "closed" ? undefined : ai.getSelectionAnchor();
  const resetFormattingToolbarAi = useFormattingToolbarAi(
    (state) => state.reset,
  );
  const wasOpenRef = useRef(false);
  const [colorScheme, setColorScheme] = useState<BnColorScheme>(() =>
    resolveBnColorScheme(editor.domElement),
  );

  const blockId = aiMenuState === "closed" ? undefined : aiMenuState.blockId;
  const open = aiMenuState !== "closed";

  // 空行没有可保留的文字选区；输入框获得焦点后仍标明 AI 作用的行。
  useEffect(() => {
    if (!open || selection || !blockId || !isEmptyParagraphBlock(editor.getBlock(blockId))) return;
    const block = Array.from(editor.domElement?.querySelectorAll(".bn-block[data-id]") ?? [])
      .find((element) => element.getAttribute("data-id") === blockId);
    const outer = block?.closest(".bn-block-outer");
    outer?.classList.add("goose-ai-empty-target");
    return () => outer?.classList.remove("goose-ai-empty-target");
  }, [blockId, editor, open, selection]);

  // 打开时读取 + 监听 html class / 编辑器 bn-root 的 color-scheme，主题切换能跟上
  useEffect(() => {
    const read = () => {
      setColorScheme(resolveBnColorScheme(editor.domElement));
    };
    read();
    if (typeof document === "undefined") return;

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const bnRoot = editor.domElement?.closest(".bn-root");
    if (bnRoot) {
      observer.observe(bnRoot, {
        attributes: true,
        attributeFilter: ["data-color-scheme"],
      });
    }
    return () => observer.disconnect();
  }, [editor.domElement, open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      try { setFakeSelection(editor, null); } catch { /* Editor may be detached. */ }
      resetFormattingToolbarAi(editor);
    }
    wasOpenRef.current = open;
  }, [editor, open, resetFormattingToolbarAi]);

  useEffect(() => () => {
    try { setFakeSelection(editor, null); } catch { /* Editor may be detached. */ }
    resetFormattingToolbarAi(editor);
  }, [editor, page.id, resetFormattingToolbarAi]);

  const floatingUIOptions = useMemo<FloatingUIOptions>(() => {
    const pad = AI_MENU_VIEWPORT_PAD_PX;

    const sharedMiddleware = [
      offset(() => getScaledEditorUiPx(10)),
      flip({
        fallbackPlacements: ["top-start", "bottom-end", "top-end"],
        padding: pad,
      }),
      shift({
        padding: pad,
        crossAxis: false,
      }),
      size({
        apply({ availableWidth, availableHeight, elements }) {
          const maxW = computeAiMenuFloatingWidth({
            viewportWidth:
              typeof window !== "undefined" ? window.innerWidth : 1248,
            availableWidth,
            scale: getEditorUiScale(),
          });
          Object.assign(elements.floating.style, {
            width: `${maxW}px`,
            maxWidth: `${maxW}px`,
            maxHeight: `${Math.max(100, availableHeight)}px`,
            overflowY: "auto",
          });
        },
        padding: pad,
      }),
    ];

    return {
      useFloatingOptions: {
        open,
        // 选区与块锚点都用 start 对齐，避免 bottom 居中导致菜单跑到标题下方中间
        placement: "bottom-start",
        middleware: sharedMiddleware,
        onOpenChange: (nextOpen) => {
          if (nextOpen || aiMenuState === "closed") return;
          ai.closeAIMenu();
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
        outsidePress: false,
      },
      elementProps: {
        className: "bn-root bn-mantine goose-ai-menu-floating",
        "data-color-scheme": colorScheme,
        style: { zIndex: 20010 },
      },
      focusManagerProps: {
        disabled: false,
        modal: false,
        returnFocus: false,
        getInsideElements: () => (editor.domElement ? [editor.domElement] : []),
      },
    };
  }, [ai, aiMenuState, colorScheme, editor.domElement, open]);

  // GenericPopover 的外层负责 viewport 定位；缩放只放在内层 surface，
  // 避免 CSS zoom 同时放大 Floating UI 计算出的 fixed 坐标。
  const content = open ? (
    <div
      className="goose-editor-context-ui bn-root bn-mantine"
      data-color-scheme={colorScheme}
    >
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
