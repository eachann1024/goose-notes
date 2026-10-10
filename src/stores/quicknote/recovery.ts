import type { QuickNoteSlot, QuickNoteDrafts } from "./types";
import type { JSONContent } from "@/types";
import {
  recordRecoveryEntry,
  listRecoveryEntries,
  acknowledgeRecoveryEntry,
  canApplyRecoveryEntry,
} from "@/lib/storage/recoveryJournal";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { toast } from "@/components/ui/sonner";
import { normalizeDrafts, normalizeSlot } from "./normalization";
import type { StateStorage } from "zustand/middleware";
import { localStorageAdapter, setDbStorageItem } from "@/lib/storage";
import { useQuickNote } from "../useQuickNote";

export const pendingQuickNoteRecoveryRevisions = new Map<
  QuickNoteSlot,
  number
>();

export const recordQuickNoteRecovery = (
  slot: QuickNoteSlot,
  previous: JSONContent | null,
  content: JSONContent | null,
): void => {
  const entry = recordRecoveryEntry({
    source: "quicknote",
    id: String(slot),
    content,
    baseSignature: getContentSignature(previous),
  });
  if (entry) {
    pendingQuickNoteRecoveryRevisions.set(slot, entry.revision);
    return;
  }
  toast.error("速记恢复备份写入失败", {
    id: "goose-quicknote-journal-failed",
    description: "请暂时不要关闭小窗，并复制重要内容后重试。",
  });
};

export function recoverQuickNoteDrafts(draftsRaw: unknown): {
  drafts: QuickNoteDrafts;
  recoveredSlots: QuickNoteSlot[];
  conflictSlots: QuickNoteSlot[];
} {
  const drafts = normalizeDrafts(draftsRaw);
  const recoveredSlots: QuickNoteSlot[] = [];
  const conflictSlots: QuickNoteSlot[] = [];
  for (const entry of listRecoveryEntries("quicknote")) {
    const slot = normalizeSlot(entry.id);
    const current = drafts[slot];
    const alreadyCurrent =
      getContentSignature(current) === getContentSignature(entry.content);
    if (alreadyCurrent) {
      if (
        !acknowledgeRecoveryEntry("quicknote", String(slot), entry.revision)
      ) {
        pendingQuickNoteRecoveryRevisions.set(slot, entry.revision);
      }
      continue;
    }
    if (!canApplyRecoveryEntry(entry, current)) {
      conflictSlots.push(slot);
      continue;
    }
    drafts[slot] = entry.content;
    recoveredSlots.push(slot);
    pendingQuickNoteRecoveryRevisions.set(slot, entry.revision);
  }
  return { drafts, recoveredSlots, conflictSlots };
}

export const quickNoteStorage: StateStorage = {
  getItem: (name) => localStorageAdapter.getItem(name),
  setItem: (name, value) => {
    const saved = setDbStorageItem(name, value);
    if (saved) {
      for (const [slot, revision] of pendingQuickNoteRecoveryRevisions) {
        const acknowledged = acknowledgeRecoveryEntry(
          "quicknote",
          String(slot),
          revision,
        );
        if (
          acknowledged &&
          pendingQuickNoteRecoveryRevisions.get(slot) === revision
        ) {
          pendingQuickNoteRecoveryRevisions.delete(slot);
        }
      }
      return;
    }
    toast.error("速记暂未保存", {
      id: "goose-quicknote-save-failed",
      description: "当前草稿已放入恢复备份，可点击重试。",
      action: {
        label: "重试",
        onClick: () => {
          useQuickNote.setState((state) => ({ drafts: { ...state.drafts } }));
        },
      },
    });
  },
  removeItem: (name) => localStorageAdapter.removeItem(name),
};
