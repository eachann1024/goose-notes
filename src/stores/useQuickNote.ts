import { create } from "zustand";
import type { QuickNoteState } from "./quicknote/types";
import { persist, createJSONStorage } from "zustand/middleware";
import { createQuickNoteState } from "./quicknote/actions";
import { quickNoteStorage, recoverQuickNoteDrafts } from "./quicknote/recovery";
import {
  budgetQuickNoteHistory,
  createEmptySlotStacks,
  normalizeSlotStacks,
} from "@/lib/quicknote/undoHistory";
import {
  normalizeDrafts,
  createDefaultQuickNoteSlotNames,
  normalizeSlot,
  normalizeSlotNames,
} from "./quicknote/normalization";
import type { JSONContent } from "@/types";
import { toast } from "@/components/ui/sonner";

export const useQuickNote = create<QuickNoteState>()(
  persist(createQuickNoteState, {
    name: "goose-note:quicknote",
    version: 3,
    storage: createJSONStorage(() => quickNoteStorage),
    partialize: (state) => ({
      ...budgetQuickNoteHistory(state.undoStacks, state.redoStacks),
      activeSlot: state.activeSlot,
      drafts: state.drafts,
      slotNames: state.slotNames,
      pinned: true, // 强制置顶，写回恒 true
      editorZoom: state.editorZoom,
      windowWidth: state.windowWidth,
      windowHeight: state.windowHeight,
      // 位置：preload 与 setWindowPosition 双写；这里必须始终带上 store 内最新
      // windowX/Y，否则草稿 onChange 触发的 persist 会用缺省/旧值把 preload 刚写的位置抹掉。
      windowX: state.windowX,
      windowY: state.windowY,
    }),
    migrate: (persisted, version) => {
      const raw = (persisted ?? {}) as Record<string, unknown>;
      if (version < 1) {
        // v0：单字段 draftContent → 槽位 1，其余空
        return {
          ...raw,
          activeSlot: 1,
          drafts: normalizeDrafts(
            undefined,
            (raw.draftContent as JSONContent | null) ?? null,
          ),
          slotNames: createDefaultQuickNoteSlotNames(),
          undoStacks: createEmptySlotStacks(),
          redoStacks: createEmptySlotStacks(),
        };
      }
      if (version < 2) {
        return {
          ...raw,
          activeSlot: normalizeSlot(raw.activeSlot),
          drafts: normalizeDrafts(
            raw.drafts,
            (raw.draftContent as JSONContent | null) ?? null,
          ),
          slotNames: createDefaultQuickNoteSlotNames(),
          undoStacks: createEmptySlotStacks(),
          redoStacks: createEmptySlotStacks(),
        };
      }
      const normalized = {
        ...raw,
        activeSlot: normalizeSlot(raw.activeSlot),
        drafts: normalizeDrafts(
          raw.drafts,
          (raw.draftContent as JSONContent | null) ?? null,
        ),
        undoStacks: normalizeSlotStacks(raw.undoStacks),
        redoStacks: normalizeSlotStacks(raw.redoStacks),
        slotNames: normalizeSlotNames(raw.slotNames),
      };
      return normalized;
    },
    // 兜底：缺 drafts / 脏 activeSlot 时仍能归一，避免 rehydrate 后崩溃
    merge: (persisted, current) => {
      const p = (persisted ?? {}) as Record<string, unknown>;
      const recovery = recoverQuickNoteDrafts(
        normalizeDrafts(
          p.drafts,
          (p.draftContent as JSONContent | null | undefined) ?? null,
        ),
      );
      const history = budgetQuickNoteHistory(
        p.undoStacks ?? (current as QuickNoteState).undoStacks,
        p.redoStacks ?? (current as QuickNoteState).redoStacks,
      );
      if (recovery.recoveredSlots.length > 0) {
        queueMicrotask(() =>
          toast.warning("已恢复未完成保存的速记", {
            id: "goose-quicknote-recovered",
            description: "恢复内容已放回原便签槽位，请确认后继续编辑。",
          }),
        );
      }
      if (recovery.conflictSlots.length > 0) {
        queueMicrotask(() =>
          toast.warning("发现未自动覆盖的速记恢复稿", {
            id: "goose-quicknote-recovery-conflict",
            description: "现有草稿更新，恢复稿仍被安全保留。",
          }),
        );
      }
      return {
        ...current,
        ...p,
        activeSlot: normalizeSlot(p.activeSlot ?? current.activeSlot),
        drafts: recovery.drafts,
        slotNames: normalizeSlotNames(p.slotNames),
        undoStacks: history.undoStacks,
        redoStacks: history.redoStacks,
        pinned: true,
      } as typeof current;
    },
    skipHydration: true,
  }),
);

export {
  type QuickNoteSlot,
  QUICKNOTE_SLOT_COUNT,
  QUICKNOTE_SLOTS,
  type QuickNoteDrafts,
  type QuickNoteSlotNames,
  QUICKNOTE_DEFAULT_WIDTH,
  QUICKNOTE_MIN_WIDTH,
  QUICKNOTE_DEFAULT_HEIGHT,
  QUICKNOTE_MIN_HEIGHT,
  QUICKNOTE_ZOOM_MIN,
  QUICKNOTE_ZOOM_MAX,
  QUICKNOTE_ZOOM_STEP,
  QUICKNOTE_ZOOM_DEFAULT,
  clampQuickNoteZoom,
} from "./quicknote/types";
export {
  createEmptyQuickNoteDrafts,
  createDefaultQuickNoteSlotNames,
} from "./quicknote/normalization";
export {
  updateQuickNoteSlotName,
  parsePersistedQuickNoteSlotNames,
  serializeQuickNoteSlotNames,
  loadQuickNoteSlotNames,
  persistQuickNoteSlotNames,
  getQuickNoteSlotName,
} from "./quicknote/slotNames";
export { recoverQuickNoteDrafts } from "./quicknote/recovery";
export {
  isQuickNoteDraftEmpty,
  extractQuickNoteDraftTitle,
  getActiveDraftContent,
  buildQuickNoteDraftPage,
} from "./quicknote/content";
