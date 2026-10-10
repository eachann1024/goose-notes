import { type CSSProperties } from "react";
import { getQuickNoteSlotName, QUICKNOTE_SLOTS } from "@/stores/useQuickNote";
import { type QuickNoteSlotSwitcherProps } from "./slot-switcher/shared";
import { useQuickNoteSlotPreview } from "./slot-switcher/useQuickNoteSlotPreview";
import { useQuickNoteSlotInput } from "./slot-switcher/useQuickNoteSlotInput";

export function QuickNoteSlotSwitcher(props: QuickNoteSlotSwitcherProps) {
  const preview = useQuickNoteSlotPreview(props);
  const quickNoteSlotInputContext = useQuickNoteSlotInput(preview);
  const context = quickNoteSlotInputContext;
  const {
    occupiedSlots,
    slotNames,
    rootRef,
    scrubbing,
    visualSlot,
    onKeyDown,
    onPointerDown,
    onRootPointerLeave,
  } = context;

  return (
    <div
      ref={rootRef}
      className="quicknote-slot-switcher"
      data-scrubbing={scrubbing ? "true" : "false"}
      role="radiogroup"
      aria-label="切换便签"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      onMouseLeave={onRootPointerLeave}
      onKeyDown={onKeyDown}
    >
      {QUICKNOTE_SLOTS.map((slot) => {
        const active = slot === visualSlot;
        const occupied = occupiedSlots[slot];
        const slotName = getQuickNoteSlotName(slot, slotNames);
        return (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${slotName}${occupied ? "，有内容" : "，空白"}`}
            title={`${slotName}；再次点击可改名`}
            tabIndex={active ? 0 : -1}
            data-slot={slot}
            data-active={active ? "true" : "false"}
            data-occupied={occupied ? "true" : "false"}
            className="quicknote-slot-btn"
            onPointerDown={(e) => onPointerDown(e, slot)}
            // 选择由 pointer 提交；避免 click 与拖动松手重复触发
            onClick={(e) => e.preventDefault()}
          >
            <span className="quicknote-slot-btn-label">{slot}</span>
          </button>
        );
      })}
    </div>
  );
}
