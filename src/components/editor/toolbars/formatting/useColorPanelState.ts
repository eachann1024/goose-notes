import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { setFakeSelection } from "@/components/editor/extensions/fakeSelectionExtension";
import {
  restoreTextSelectionRange,
  withPreservedSelection,
} from "./selectionRestore";
import {
  measureColorPanelPosition,
  type PositionState,
} from "./colorPanelGeometry";
import {
  resolveHeldTextSelection,
  resolveOpenColorState,
  applyHeldColorPatch,
} from "./heldColorSelection";
import { MIXED } from "./colorPalette";
import type { useSelectionColorState } from "./useSelectionColors";

export function useColorPanelState(
  editor: BlockNoteEditor<any, any, any>,
  selectionColors: ReturnType<typeof useSelectionColorState>,
  onOpenChange?: (open: boolean) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const openFrameRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sideLockRef = useRef<boolean | null>(null);
  const heldSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const selectionColorsRef = useRef(selectionColors);
  selectionColorsRef.current = selectionColors;
  const [heldColors, setHeldColors] = useState(selectionColors);

  const updatePanelPosition = useCallback((allowFlip = false) => {
    if (!buttonRef.current) return;
    const next = measureColorPanelPosition(
      buttonRef.current,
      panelRef.current,
      allowFlip ? undefined : (sideLockRef.current ?? undefined),
    );
    sideLockRef.current = next.showAbove;
    setPosition(next);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeAnimTimeoutRef.current)
        clearTimeout(closeAnimTimeoutRef.current);
      if (openFrameRef.current != null) {
        cancelAnimationFrame(openFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(isMounted);
  }, [isMounted, onOpenChange]);

  useEffect(() => {
    return () => onOpenChange?.(false);
  }, [onOpenChange]);

  const holdCurrentSelection = useCallback(() => {
    const { selection } = editor.prosemirrorState;
    const next = resolveHeldTextSelection(selection, heldSelectionRef.current);
    heldSelectionRef.current = next;
    if (next) setFakeSelection(editor, next);
    return next;
  }, [editor]);

  const applyWithHeldSelection = useCallback(
    (
      apply: () => void,
      patch?: Partial<Pick<typeof heldColors, "textColor" | "backgroundColor">>,
    ) => {
      restoreTextSelectionRange(editor, heldSelectionRef.current);
      withPreservedSelection(editor, apply);
      if (patch) {
        setHeldColors((prev) => applyHeldColorPatch(prev, patch));
      }
      holdCurrentSelection();
    },
    [editor, holdCurrentSelection],
  );

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
    if (!buttonRef.current) return;

    onOpenChange?.(true);
    if (!isMounted && !editor.prosemirrorState.selection.empty) {
      setHeldColors(selectionColorsRef.current);
    }
    holdCurrentSelection();

    if (isMounted) {
      setIsOpen(true);
      return;
    }

    const next = measureColorPanelPosition(buttonRef.current, panelRef.current);
    sideLockRef.current = next.showAbove;
    setPosition(next);
    setIsMounted(true);
    if (openFrameRef.current != null)
      cancelAnimationFrame(openFrameRef.current);
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = requestAnimationFrame(() => {
        setIsOpen(true);
        openFrameRef.current = null;
      });
    });
  };

  useLayoutEffect(() => {
    if (!isMounted || !buttonRef.current) return;
    updatePanelPosition(false);
  }, [isMounted, updatePanelPosition]);

  useEffect(() => {
    if (!isMounted) return;
    const update = () => updatePanelPosition(true);
    window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
      window.removeEventListener("resize", update);
    };
  }, [isMounted, updatePanelPosition]);

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      return;
    }
    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
    closeAnimTimeoutRef.current = setTimeout(() => {
      sideLockRef.current = null;
      heldSelectionRef.current = null;
      setFakeSelection(editor, null);
      setIsMounted(false);
      setPosition(null);
    }, 180);
  }, [editor, isOpen]);

  useEffect(() => {
    if (!isMounted) return;
    holdCurrentSelection();
  }, [editor, holdCurrentSelection, isMounted]);

  const displayColors = resolveOpenColorState(
    selectionColors,
    heldColors,
    isMounted,
  );
  const currentTextColor = displayColors.textColor;
  const currentBgColor = displayColors.backgroundColor;
  const isTextMixed = currentTextColor === MIXED;
  const isBgMixed = currentBgColor === MIXED;

  const isTextColorActive =
    !isTextMixed && currentTextColor && currentTextColor !== "default";
  const isBgColorActive =
    !isBgMixed && currentBgColor && currentBgColor !== "default";

  return {
    isOpen,
    isMounted,
    position,
    buttonRef,
    panelRef,
    handleMouseEnter,
    handleMouseLeave,
    displayColors,
    currentTextColor,
    currentBgColor,
    isTextMixed,
    isBgMixed,
    isTextColorActive,
    isBgColorActive,
    applyWithHeldSelection,
  };
}
