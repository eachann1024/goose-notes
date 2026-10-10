import type { QuickNoteSlotNames, QuickNoteSlot } from "./types";
import {
  normalizeSlot,
  normalizeSlotName,
  normalizeSlotNames,
} from "./normalization";
import { getDbStorageItem, setDbStorageItem } from "@/lib/storage";

/**
 * 便签名称单独落库，避免改名时同步重写包含正文与 200 步撤销快照的速记主文档。
 * Electron 的数据库调用是同步的；主文档较大时，这种无关的整包写入会直接堵住旧渲染进程。
 */
export const QUICKNOTE_SLOT_NAMES_STORAGE_KEY =
  "goose-note:quicknote-slot-names";

export interface PersistedQuickNoteSlotNames {
  version: 1;
  slotNames: QuickNoteSlotNames;
}

export function updateQuickNoteSlotName(
  current: QuickNoteSlotNames,
  slot: QuickNoteSlot,
  name: string,
): QuickNoteSlotNames {
  const target = normalizeSlot(slot);
  const normalizedName = normalizeSlotName(name);
  if (current[target] === normalizedName) return current;
  return { ...current, [target]: normalizedName };
}

export function parsePersistedQuickNoteSlotNames(
  raw: string | null,
  fallback: QuickNoteSlotNames,
): QuickNoteSlotNames {
  if (!raw) return normalizeSlotNames(fallback);
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedQuickNoteSlotNames>;
    return normalizeSlotNames(parsed.slotNames);
  } catch {
    return normalizeSlotNames(fallback);
  }
}

export function serializeQuickNoteSlotNames(
  slotNames: QuickNoteSlotNames,
): string {
  return JSON.stringify({
    version: 1,
    slotNames: normalizeSlotNames(slotNames),
  } satisfies PersistedQuickNoteSlotNames);
}

/** 新存储不存在时以主文档里的旧字段兜底，实现无感迁移。 */
export function loadQuickNoteSlotNames(
  legacyNames: QuickNoteSlotNames,
): QuickNoteSlotNames {
  return parsePersistedQuickNoteSlotNames(
    getDbStorageItem(QUICKNOTE_SLOT_NAMES_STORAGE_KEY),
    legacyNames,
  );
}

export function persistQuickNoteSlotNames(slotNames: QuickNoteSlotNames): void {
  setDbStorageItem(
    QUICKNOTE_SLOT_NAMES_STORAGE_KEY,
    serializeQuickNoteSlotNames(slotNames),
  );
}

export function getQuickNoteSlotName(
  slot: QuickNoteSlot,
  names: QuickNoteSlotNames,
): string {
  return normalizeSlotName(names[slot]) || `便签 ${slot}`;
}
