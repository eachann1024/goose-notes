import type {
  QuickNoteDrafts,
  QuickNoteSlotNames,
  QuickNoteSlot,
} from "./types";
import type { JSONContent } from "@/types";
import { QUICKNOTE_SLOTS } from "./types";

export function createEmptyQuickNoteDrafts(): QuickNoteDrafts {
  return { 1: null, 2: null, 3: null, 4: null, 5: null };
}

export function createDefaultQuickNoteSlotNames(): QuickNoteSlotNames {
  return { 1: "", 2: "", 3: "", 4: "", 5: "" };
}

export function normalizeSlot(value: unknown): QuickNoteSlot {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 2 || n === 3 || n === 4 || n === 5) return n;
  return 1;
}

export function normalizeDrafts(
  raw: unknown,
  legacyDraft?: JSONContent | null,
): QuickNoteDrafts {
  const empty = createEmptyQuickNoteDrafts();
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, JSONContent | null>;
    for (const slot of QUICKNOTE_SLOTS) {
      const key = String(slot);
      if (key in rec) empty[slot] = rec[key] ?? null;
      else if (slot in (raw as object)) {
        empty[slot] = (raw as QuickNoteDrafts)[slot] ?? null;
      }
    }
    return empty;
  }
  // 旧版单草稿：迁移到槽位 1
  if (legacyDraft !== undefined) {
    empty[1] = legacyDraft ?? null;
  }
  return empty;
}

export function normalizeSlotName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 24) : "";
}

export function normalizeSlotNames(raw: unknown): QuickNoteSlotNames {
  const names = createDefaultQuickNoteSlotNames();
  if (!raw || typeof raw !== "object") return names;
  const record = raw as Record<string, unknown>;
  for (const slot of QUICKNOTE_SLOTS) {
    names[slot] = normalizeSlotName(record[String(slot)]);
  }
  return names;
}
