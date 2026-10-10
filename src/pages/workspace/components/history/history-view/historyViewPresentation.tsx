import type { HistoryIndexEntry } from "@/lib/history/types";
import {
  createEditorSafeContent,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { editorSchema } from "@/components/editor/core/EditorComposer";

export const TRIGGER_LABEL: Record<HistoryIndexEntry["trigger"], string> = {
  idle: "自动",
  manual: "手动",
  "pre-op": "操作前",
};

export type SelectedHistoryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing"
  | "error";

export function triggerLabel(trigger: HistoryIndexEntry["trigger"]): string {
  return TRIGGER_LABEL[trigger] ?? "自动";
}

export function createSafeHistoryContent(
  content: unknown,
): BlockNoteContent | null {
  try {
    return createEditorSafeContent(
      normalizePageContent(content as any),
      editorSchema,
    );
  } catch (error) {
    console.error("[history] normalize history content failed", error);
    return null;
  }
}

export function formatGroupLabel(ts: number, now: number): string {
  const d1 = new Date(ts);
  const d2 = new Date(now);
  const day1 = new Date(
    d1.getFullYear(),
    d1.getMonth(),
    d1.getDate(),
  ).getTime();
  const day2 = new Date(
    d2.getFullYear(),
    d2.getMonth(),
    d2.getDate(),
  ).getTime();
  const diffDays = Math.floor((day2 - day1) / (24 * 3600 * 1000));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return d1.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
