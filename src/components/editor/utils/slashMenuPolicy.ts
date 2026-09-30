import type { BlockNoteEditor } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import type { Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

const SLASH_TRIGGERS = ["/", "、"] as const;

export type SlashMenuPagePolicy = {
  /** local-folder 或速记草稿：首块可弹 slash（标题不在首块内） */
  allowSlashMenuOnFirstBlock: boolean;
};

/** Enter（无 Shift）或无修饰键的 Tab：确认当前 @ / 建议项。 */
export function isSuggestionMenuAcceptKey(event: {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  if (event.key === "Enter") return !event.shiftKey;
  if (event.key !== "Tab") return false;
  return !event.shiftKey && !event.metaKey && !event.altKey && !event.ctrlKey;
}

/** `@` 前面是邮箱/标识符内部时不弹；中文、空白、标点都算边界。 */
export function isPageMentionBoundaryChar(charBefore: string): boolean {
  if (!charBefore) return true;
  if (charBefore === "@") return false;
  return !/[A-Za-z0-9._-]/.test(charBefore);
}

export function findActivePageMentionQuery(textBefore: string): {
  atIndex: number;
  query: string;
} | null {
  const atIndex = textBefore.lastIndexOf("@");
  if (atIndex < 0) return null;
  const charBefore = atIndex === 0 ? "" : textBefore.charAt(atIndex - 1);
  if (!isPageMentionBoundaryChar(charBefore)) return null;
  const query = textBefore.slice(atIndex + 1);
  if (/[\s\u00a0\u200b]/.test(query) || query.includes("\ufffc")) return null;
  return { atIndex, query };
}

/** 选中 @ 建议前要删掉的 `@query` 范围（含触发符）。 */
export function mentionTriggerDeleteRange(
  blockStart: number,
  textBefore: string,
  caret: number,
): { from: number; to: number } | null {
  const active = findActivePageMentionQuery(textBefore);
  if (!active) return null;
  const from = blockStart + active.atIndex;
  if (from >= caret) return null;
  return { from, to: caret };
}

function isCodeTextblockParent(parent: {
  type: { spec?: { code?: boolean } };
}): boolean {
  return Boolean(parent.type.spec?.code);
}

function isInsideCodeBlock($from: Transaction["selection"]["$from"]): boolean {
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "codeBlock") return true;
  }
  return false;
}

function isCodeLikeEditorBlock(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  try {
    return editor.getTextCursorPosition().block?.type === "codeBlock";
  } catch {
    return false;
  }
}

function hasCodeMark($from: Transaction["selection"]["$from"]): boolean {
  return $from.marks().some((mark) => mark.type.name === "code");
}

/** 与 EditorComposer SuggestionMenuController.shouldOpen 共用 */
export function shouldOpenSlashSuggestionMenu(
  tr: Transaction,
  editor: BlockNoteEditor<any, any, any>,
  policy: SlashMenuPagePolicy,
): boolean {
  if (!editor.isEditable) return false;
  const $from = tr.selection.$from;
  if (!policy.allowSlashMenuOnFirstBlock) {
    const cursorBlock = editor.getTextCursorPosition().block;
    if (cursorBlock && cursorBlock.id === editor.document[0]?.id) return false;
  }
  if ($from.parentOffset !== 0) return false;
  if (isCodeTextblockParent($from.parent)) return false;
  return !$from.parent.type.isInGroup("tableContent");
}

/**
 * `@` 在任意 inline 块中、词边界处触发：段落、标题、列表、待办、引用、高亮块、表格单元格。
 * 代码块与行内代码不弹。
 */
export function shouldOpenPageMentionSuggestionMenu(
  tr: Transaction,
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  if (!editor.isEditable) return false;
  const $from = tr.selection.$from;
  if (!$from.parent.isTextblock) return false;
  if (
    isCodeTextblockParent($from.parent) ||
    isInsideCodeBlock($from) ||
    isCodeLikeEditorBlock(editor) ||
    hasCodeMark($from)
  ) {
    return false;
  }
  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "\ufffc",
  );
  const charBefore = textBefore.slice(-1);
  return isPageMentionBoundaryChar(charBefore);
}

/**
 * BlockNote 仅在 handleTextInput 插入触发符时开菜单；删光 query 后块首仍留 `/` 时不会再开。
 * 文档稳定后检测并程序化 reopen + 恢复 query。
 */
export function reconcileSlashSuggestionMenu(
  editor: BlockNoteEditor<any, any, any>,
  policy: SlashMenuPagePolicy,
): void {
  if (!editor.isEditable) return;

  const sug = editor.getExtension(SuggestionMenu);
  if (!sug || sug.shown()) return;

  const view = editor.prosemirrorView;
  if (!view) return;
  if (view.composing) return;

  const { selection } = view.state;
  if (!selection.empty) return;

  const $from = selection.$from;
  const parent = $from.parent;
  if (!parent.isTextblock || isCodeTextblockParent(parent)) return;
  if (parent.type.isInGroup("tableContent")) return;

  if (!policy.allowSlashMenuOnFirstBlock) {
    const cursorBlock = editor.getTextCursorPosition().block;
    if (cursorBlock && cursorBlock.id === editor.document[0]?.id) return;
  }

  const trigger = SLASH_TRIGGERS.find((t) => parent.textContent.startsWith(t));
  if (!trigger) return;
  const query = parent.textContent.slice(trigger.length);
  // Local paths such as `/Users/name/project` also start with `/`, but they
  // are content, not slash-command queries. Touching selection while IME is
  // settling can make those long path lines visually flicker.
  if (query.includes("/") || query.includes("\\")) return;

  const blockStart = $from.start();
  const caret = selection.from;
  if (caret <= blockStart) return;

  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, blockStart + trigger.length),
    ),
  );
  sug.openSuggestionMenu(trigger);
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)),
  );
}

/** 删光 query 后行内仍留边界 `@` 时重新打开提及菜单。 */
export function reconcilePageMentionSuggestionMenu(
  editor: BlockNoteEditor<any, any, any>,
): void {
  if (!editor.isEditable) return;

  const sug = editor.getExtension(SuggestionMenu);
  if (!sug || sug.shown()) return;

  const view = editor.prosemirrorView;
  if (!view) return;
  if (view.composing) return;

  const { selection } = view.state;
  if (!selection.empty) return;

  const $from = selection.$from;
  const parent = $from.parent;
  if (!parent.isTextblock || isCodeTextblockParent(parent)) return;
  if (
    isInsideCodeBlock($from) ||
    isCodeLikeEditorBlock(editor) ||
    hasCodeMark($from)
  ) {
    return;
  }

  const textBefore = parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "\ufffc",
  );
  const active = findActivePageMentionQuery(textBefore);
  if (!active) return;

  const blockStart = $from.start();
  const caret = selection.from;
  const triggerPos = blockStart + active.atIndex + 1;
  if (caret < triggerPos) return;

  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, triggerPos)),
  );
  sug.openSuggestionMenu("@");
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)),
  );
}
