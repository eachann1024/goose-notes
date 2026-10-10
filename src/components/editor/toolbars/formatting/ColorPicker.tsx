import { useBlockNoteEditor } from "@blocknote/react";
import * as GooseIcons from "@/components/ui/icons";
import { Portal } from "@/components/editor/ui/portal";
import { cn } from "@/components/editor/utils/cn";
import { useSelectionColorState } from "./useSelectionColors";
import { useColorPanelState } from "./useColorPanelState";
import { useColorActions } from "./useColorActions";
import { ColorPickerPanel } from "./ColorPickerPanel";

export { getColorPanelPosition } from "./colorPanelGeometry";
export {
  resolveHeldTextSelection,
  resolveHeldColorState,
  resolveOpenColorState,
  applyHeldColorPatch,
  isColorSwatchSelected,
} from "./heldColorSelection";
export { selectionUsesLastFormatColors } from "./lastFormatColors";

export function FormattingToolbarColorPicker({
  onOpenChange,
}: { onOpenChange?: (open: boolean) => void } = {}) {
  const editor = useBlockNoteEditor();
  const selectionColors = useSelectionColorState(editor);
  const panel = useColorPanelState(editor, selectionColors, onOpenChange);
  const actions = useColorActions(editor, panel);
  const {
    handleMouseEnter,
    handleMouseLeave,
    buttonRef,
    isMounted,
    isTextColorActive,
    isBgColorActive,
    isTextMixed,
    isBgMixed,
  } = panel;
  const { applyLastFormatColors, lastTextPreview, lastColorBar } = actions;
  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        ref={buttonRef}
        data-goose-preserve-icon-color="true"
        aria-pressed={
          isMounted ||
          isTextColorActive ||
          isBgColorActive ||
          isTextMixed ||
          isBgMixed
        }
        className={cn("goose-formatting-toolbar-control")}
        aria-label="颜色选择；点击应用上次颜色"
        onClick={() => {
          applyLastFormatColors();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          applyLastFormatColors();
        }}
      >
        <span className="relative inline-flex size-4 items-center justify-center">
          <GooseIcons.Palette
            aria-hidden="true"
            className="size-4"
            style={lastTextPreview ? { color: lastTextPreview } : undefined}
          />
          {lastColorBar ? (
            <span
              className="absolute inset-x-0.5 bottom-0 h-0.5 rounded-marker"
              style={{ background: lastColorBar }}
            />
          ) : null}
        </span>
      </button>
      <Portal>
        <ColorPickerPanel panel={panel} actions={actions} />
      </Portal>
    </div>
  );
}
