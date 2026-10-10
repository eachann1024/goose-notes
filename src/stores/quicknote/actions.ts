import type { QuickNoteSlot, QuickNoteState } from "./types";
import {
  createEmptyQuickNoteDrafts,
  createDefaultQuickNoteSlotNames,
  normalizeSlot,
} from "./normalization";
import {
  createEmptySlotStacks,
  recordEditHistory,
  applyUndo,
  applyRedo,
} from "@/lib/quicknote/undoHistory";
import {
  QUICKNOTE_DEFAULT_WIDTH,
  QUICKNOTE_DEFAULT_HEIGHT,
  QUICKNOTE_ZOOM_DEFAULT,
  QUICKNOTE_MIN_WIDTH,
  QUICKNOTE_MIN_HEIGHT,
  clampQuickNoteZoom,
} from "./types";
import { updateQuickNoteSlotName } from "./slotNames";
import { recordQuickNoteRecovery } from "./recovery";
import {
  getActiveDraftContent,
  isQuickNoteDraftEmpty,
  extractQuickNoteDraftTitle,
} from "./content";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

/** 会话内每槽最近一次成功记入撤销栈的时间（不持久化，仅用于输入合并窗口）。 */
export const lastUndoRecordAtBySlot: Partial<Record<QuickNoteSlot, number>> =
  {};

export function createQuickNoteState(
  set: import("zustand").StoreApi<QuickNoteState>["setState"],
  get: import("zustand").StoreApi<QuickNoteState>["getState"],
): QuickNoteState {
  return {
    activeSlot: 1,

    drafts: createEmptyQuickNoteDrafts(),

    slotNames: createDefaultQuickNoteSlotNames(),

    undoStacks: createEmptySlotStacks(),

    redoStacks: createEmptySlotStacks(),

    pinned: true,

    // 强制置顶，恒 true
    windowWidth: QUICKNOTE_DEFAULT_WIDTH,

    windowHeight: QUICKNOTE_DEFAULT_HEIGHT,

    windowX: undefined,

    windowY: undefined,

    editorZoom: QUICKNOTE_ZOOM_DEFAULT,

    setActiveSlot: (slot) => {
      const next = normalizeSlot(slot);
      const previous = get().activeSlot;
      if (next === previous) return;
      // 切槽是明确的编辑边界：回到任一槽后首次输入都应形成新撤销步，
      // 不能和切换前 800ms 内的输入合并，否则一次撤销会直接退回空稿。
      lastUndoRecordAtBySlot[previous] = 0;
      lastUndoRecordAtBySlot[next] = 0;
      set({ activeSlot: next });
    },

    setSlotName: (slot, name) => {
      const target = normalizeSlot(slot);
      set((state) => ({
        slotNames: updateQuickNoteSlotName(state.slotNames, target, name),
      }));
    },

    setDraftContent: (content, slot, options) =>
      set((state) => {
        const target = slot != null ? normalizeSlot(slot) : state.activeSlot;
        const previous = state.drafts[target] ?? null;
        const recordHistory = options?.recordHistory !== false;
        recordQuickNoteRecovery(target, previous, content);
        if (!recordHistory) {
          return {
            drafts: { ...state.drafts, [target]: content },
          };
        }
        // lastRecordAt 不持久化：用模块级 map 保持合并窗口（会话内有效即可）
        const lastAt = lastUndoRecordAtBySlot[target] ?? 0;
        const hist = recordEditHistory({
          undo: state.undoStacks[target] ?? [],
          redo: state.redoStacks[target] ?? [],
          previous,
          next: content,
          lastRecordAt: lastAt,
        });
        if (hist.recorded) {
          lastUndoRecordAtBySlot[target] = hist.lastRecordAt;
        }
        return {
          drafts: { ...state.drafts, [target]: content },
          undoStacks: { ...state.undoStacks, [target]: hist.undo },
          redoStacks: { ...state.redoStacks, [target]: hist.redo },
        };
      }),

    undoDraft: () => {
      const state = get();
      const slot = state.activeSlot;
      const result = applyUndo({
        undo: state.undoStacks[slot] ?? [],
        redo: state.redoStacks[slot] ?? [],
        current: state.drafts[slot] ?? null,
      });
      if (!result.applied) {
        return { content: state.drafts[slot] ?? null, applied: false };
      }
      // 撤销/重做本身不记入历史；并重置合并窗口，避免紧接着的 onChange 误合并
      lastUndoRecordAtBySlot[slot] = 0;
      recordQuickNoteRecovery(slot, state.drafts[slot] ?? null, result.content);
      set({
        drafts: { ...state.drafts, [slot]: result.content },
        undoStacks: { ...state.undoStacks, [slot]: result.undo },
        redoStacks: { ...state.redoStacks, [slot]: result.redo },
      });
      return { content: result.content, applied: true };
    },

    redoDraft: () => {
      const state = get();
      const slot = state.activeSlot;
      const result = applyRedo({
        undo: state.undoStacks[slot] ?? [],
        redo: state.redoStacks[slot] ?? [],
        current: state.drafts[slot] ?? null,
      });
      if (!result.applied) {
        return { content: state.drafts[slot] ?? null, applied: false };
      }
      lastUndoRecordAtBySlot[slot] = 0;
      recordQuickNoteRecovery(slot, state.drafts[slot] ?? null, result.content);
      set({
        drafts: { ...state.drafts, [slot]: result.content },
        undoStacks: { ...state.undoStacks, [slot]: result.undo },
        redoStacks: { ...state.redoStacks, [slot]: result.redo },
      });
      return { content: result.content, applied: true };
    },

    saveDraftToNotebook: async () => {
      const content = getActiveDraftContent(get());
      if (isQuickNoteDraftEmpty(content)) return null;

      const notebooksState = useNotebooks.getState();
      const nbId = notebooksState.activeNotebookId ?? DEFAULT_NOTEBOOK;
      const notebook = notebooksState.notebooks[nbId];
      if (!notebook) return null;

      const title = extractQuickNoteDraftTitle(content);
      let id: string | null;
      if (notebook.source === "local-folder") {
        id =
          (await usePages.getState().createLocalPageRecord({
            workspaceId: nbId,
            title,
            content: content ?? undefined,
          })) ?? null;
      } else {
        id =
          usePages.getState().createPageRecord({
            workspaceId: nbId,
            content: content ?? undefined,
          }) || null;
      }
      if (!id) return null;

      const latest = get();
      const slot = latest.activeSlot;
      recordQuickNoteRecovery(slot, latest.drafts[slot] ?? null, null);
      lastUndoRecordAtBySlot[slot] = 0;
      set({
        drafts: { ...latest.drafts, [slot]: null },
        undoStacks: { ...latest.undoStacks, [slot]: [] },
        redoStacks: { ...latest.redoStacks, [slot]: [] },
      });
      return id;
    },

    clearDraft: () =>
      set((state) => {
        const slot = state.activeSlot;
        const previous = state.drafts[slot] ?? null;
        recordQuickNoteRecovery(slot, previous, null);
        // 清空也记一步，方便撤销恢复
        const hist = recordEditHistory({
          undo: state.undoStacks[slot] ?? [],
          redo: state.redoStacks[slot] ?? [],
          previous,
          next: null,
          lastRecordAt: 0, // 强制新步，不与编辑合并
        });
        if (hist.recorded) {
          lastUndoRecordAtBySlot[slot] = hist.lastRecordAt;
        }
        return {
          drafts: { ...state.drafts, [slot]: null },
          undoStacks: { ...state.undoStacks, [slot]: hist.undo },
          redoStacks: { ...state.redoStacks, [slot]: hist.redo },
        };
      }),

    setWindowWidth: (width) =>
      set({ windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)) }),

    setWindowHeight: (height) =>
      set({
        windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)),
      }),

    setWindowSize: (width, height) =>
      set({
        windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)),
        windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)),
      }),

    setEditorZoom: (zoom: number) =>
      set({ editorZoom: clampQuickNoteZoom(zoom) }),

    setWindowPosition: (x: number, y: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      set({ windowX: Math.round(x), windowY: Math.round(y) });
    },
  };
}
