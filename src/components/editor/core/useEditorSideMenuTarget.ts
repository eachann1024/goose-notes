import type { BlockNoteEditor } from "@blocknote/core";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  isFoldableHeadingBlock,
  readHeadingCollapsed,
} from "./toggleHeadingGutter";
import {
  HEADING_SIDE_MENU_EXTRA_GAP,
  SIDE_MENU_CONTENT_GAP,
  isPointerInSideMenuCorridor,
  isPointerOverBlockContent,
} from "./sideMenuHover";

const SIDEBAR_INTERACTION_SELECTOR = ".workspace-sidebar-pane, .rct-main-tree";
const SIDEBAR_HOVER_SELECTOR =
  ".workspace-sidebar-pane:hover, .rct-main-tree:hover";

export function useEditorSideMenuTarget(
  editor: BlockNoteEditor<any, any, any>,
  isDragging: boolean,
  menuRef: RefObject<HTMLDivElement | null>,
  pressedHandle: RefObject<boolean>,
) {
  const [hoveredBlockId, setHoveredBlockId] = useState<string>();
  const [sidebarInteracting, setSidebarInteracting] = useState(false);
  const [foldTick, setFoldTick] = useState(0);
  const dragBlockId = useRef(hoveredBlockId);
  if (!isDragging) dragBlockId.current = hoveredBlockId;
  const blockId = isDragging ? dragBlockId.current : hoveredBlockId;
  const block = blockId ? editor.getBlock(blockId) : undefined;
  const [referencePos, setReferencePos] = useState<DOMRect | null>(null);
  const corridor = useRef<{ rect: DOMRect | null; gap: number }>({
    rect: null,
    gap: 0,
  });

  // Anchor to the content under the pointer, not the editor's blank canvas.
  useLayoutEffect(() => {
    const element =
      blockId &&
      editor.prosemirrorView.dom.querySelector<HTMLElement>(
        `[data-node-type="blockContainer"][data-id="${CSS.escape(blockId)}"]`,
      );
    if (!element) {
      setReferencePos(null);
      return;
    }
    const content =
      element.querySelector<HTMLElement>(":scope > .bn-block-content") ??
      element;
    const update = () => {
      const rect = content.getBoundingClientRect();
      const column = element.closest('[data-node-type="column"]');
      const left =
        (
          column?.firstElementChild ??
          editor.prosemirrorView.dom.firstElementChild
        )?.getBoundingClientRect().left ?? rect.left;
      setReferencePos(new DOMRect(left, rect.top, rect.width, rect.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [editor, blockId, foldTick]);

  const firstBlockId = editor.document[0]?.id as string | undefined;
  const showHeadingToggle = isFoldableHeadingBlock(block, firstBlockId);
  const liveHeading = block ? (editor.getBlock(block.id) ?? block) : undefined;
  const headingExpanded = liveHeading
    ? !readHeadingCollapsed(liveHeading)
    : false;
  void foldTick;

  const sideMenuGap =
    SIDE_MENU_CONTENT_GAP +
    (block?.type === "table" ? 0 : HEADING_SIDE_MENU_EXTRA_GAP);
  corridor.current = { rect: referencePos, gap: sideMenuGap };
  useEffect(() => {
    const updateSidebarInteracting = (
      target: EventTarget | null = document.activeElement,
    ) => {
      const element = target instanceof Element ? target : null;
      const activeElement = document.activeElement;
      const next =
        Boolean(element?.closest(SIDEBAR_INTERACTION_SELECTOR)) ||
        Boolean(activeElement?.closest?.(SIDEBAR_INTERACTION_SELECTOR)) ||
        Boolean(document.querySelector(SIDEBAR_HOVER_SELECTOR));
      setSidebarInteracting(next);
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateSidebarInteracting(event.target);
      if (pressedHandle.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (menuRef.current?.contains(target)) return;
      if (
        isPointerInSideMenuCorridor(
          event.clientX,
          event.clientY,
          corridor.current.rect ?? undefined,
          corridor.current.gap,
          32,
        )
      )
        return;
      const content = target?.closest<HTMLElement>(".bn-block-content");
      if (
        content &&
        editor.prosemirrorView.dom.contains(content) &&
        isPointerOverBlockContent(content, event.clientX, event.clientY)
      ) {
        setHoveredBlockId(
          content.closest<HTMLElement>('[data-node-type="blockContainer"]')
            ?.dataset.id,
        );
      } else {
        setHoveredBlockId(undefined);
      }
    };
    const handleFocusChange = (event: FocusEvent) => {
      updateSidebarInteracting(event.target);
    };
    const handleWindowBlur = () => {
      pressedHandle.current = false;
      setHoveredBlockId(undefined);
    };
    const handlePointerUp = () => {
      pressedHandle.current = false;
    };
    window.addEventListener("blur", handleWindowBlur);

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("focusin", handleFocusChange, true);
    document.addEventListener("focusout", handleFocusChange, true);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("focusin", handleFocusChange, true);
      document.removeEventListener("focusout", handleFocusChange, true);
    };
  }, [editor, menuRef, pressedHandle]);

  const shouldShow =
    Boolean(referencePos && block) &&
    editor.isEditable &&
    (!sidebarInteracting || isDragging) &&
    (Boolean(hoveredBlockId) || isDragging);

  return {
    block,
    referencePos,
    shouldShow,
    showHeadingToggle,
    headingExpanded,
    sideMenuGap,
    setFoldTick,
  };
}
