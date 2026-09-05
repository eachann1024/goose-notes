import type { EditorState } from "prosemirror-state";
import {
  getSelectedCellPlainText,
  getSelectedPlainTextContext,
} from "@/components/editor/utils/selection";

export const FIND_SEED_MAX_LENGTH = 200;

type FindSeedEditor = {
  getSelectedText?: () => string;
  prosemirrorState?: EditorState;
  prosemirrorView?: { dom?: HTMLElement | null };
};

export function normalizeFindSeed(raw: string): string {
  const text = raw.replace(/[\r\n]+/g, " ").trim();
  if (!text) return "";
  return text.length > FIND_SEED_MAX_LENGTH
    ? text.slice(0, FIND_SEED_MAX_LENGTH)
    : text;
}

function readDomSelection(container: HTMLElement | null | undefined): string {
  if (!container) return "";
  return getSelectedPlainTextContext(container)?.selectedText ?? "";
}

/**
 * Cmd+F 打开页内查找时，把当前选区写进查找框。
 * 优先 BlockNote 选区，表格单元格和代码块再走专用/DOM 回退。
 */
export function readEditorFindSeed(
  editor: FindSeedEditor | null | undefined,
  container?: HTMLElement | null,
): string {
  if (!editor) return "";

  let raw: string;
  try {
    raw = editor.getSelectedText?.() ?? "";
  } catch {
    raw = "";
  }

  if (!raw.trim() && editor.prosemirrorState) {
    try {
      raw = getSelectedCellPlainText(editor.prosemirrorState) ?? "";
    } catch {
      raw = "";
    }
  }

  if (!raw.trim()) {
    raw = readDomSelection(container ?? editor.prosemirrorView?.dom);
  }

  return normalizeFindSeed(raw);
}
