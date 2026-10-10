import {
  type QuickNoteSlot,
  type QuickNoteSlotNames,
} from "@/stores/useQuickNote";

export interface QuickNoteSlotSwitcherProps {
  activeSlot: QuickNoteSlot;
  occupiedSlots: Record<QuickNoteSlot, boolean>;
  slotNames: QuickNoteSlotNames;
  /** 正式切换（点击 / 键盘 / 拖动松手或移走后提交） */
  onChange: (
    slot: QuickNoteSlot,
    source: "pointer" | "shortcut" | "switcher-keyboard",
  ) => void;
  /**
   * 按住拖动时的临时预览槽位；null 表示结束预览、回到 activeSlot。
   * 未传入时退化为即时 onChange（无预览态）。
   */
  onPreviewChange?: (slot: QuickNoteSlot | null) => void;
  /** 再次点击当前数字时请求重命名。 */
  onRenameRequest: (slot: QuickNoteSlot) => void;
}

export function isQuickNoteSlot(value: number): value is QuickNoteSlot {
  return (
    value === 1 || value === 2 || value === 3 || value === 4 || value === 5
  );
}
