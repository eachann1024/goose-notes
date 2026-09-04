const VOID_BLOCK_TYPES = new Set([
  "image",
  "imageResize",
  "video",
  "file",
  "audio",
  "divider",
  "codeBlock",
]);

function isInlineContentEmpty(content: unknown): boolean {
  if (content === undefined || content === null) return true;
  if (typeof content === "string") return content.trim().length === 0;
  if (!Array.isArray(content)) return false;
  if (content.length === 0) return true;
  return content.every((item) => {
    if (typeof item === "string") return item.trim().length === 0;
    if (!item || typeof item !== "object") return true;
    if (typeof (item as { text?: string }).text === "string") {
      return (item as { text: string }).text.trim().length === 0;
    }
    return false;
  });
}

export function isEmptyInlineBlock(block: {
  content?: unknown;
  type?: string;
}): boolean {
  const type = block.type;
  if (type && VOID_BLOCK_TYPES.has(type)) return false;

  const content = block.content;
  if (!type) {
    return Array.isArray(content) && content.length === 0;
  }

  return isInlineContentEmpty(content);
}

export type PasteAtCursorEditor = {
  updateBlock: (
    block: { id: string },
    update: unknown,
  ) => { id: string } | void;
  replaceBlocks: (
    blocksToRemove: unknown[],
    blocksToInsert: unknown[],
  ) => unknown[];
  insertBlocks: (
    blocks: unknown[],
    reference: unknown,
    placement: "after",
  ) => unknown[];
  setTextCursorPosition: (block: unknown, placement: "end") => void;
  focus: () => void;
};

function blockWithId(value: unknown): { id: string } | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  return { id };
}

export function pasteBlocksAtCursor(
  editor: PasteAtCursorEditor,
  blocks: unknown[],
  targetBlock: { id: string; content?: unknown; type?: string },
): { id: string } | null {
  if (blocks.length === 0) return null;

  if (isEmptyInlineBlock(targetBlock)) {
    if (blocks.length === 1) {
      editor.updateBlock(targetBlock, blocks[0]);
      return { id: targetBlock.id };
    }
    const inserted = editor.replaceBlocks([targetBlock], blocks);
    return blockWithId(inserted[inserted.length - 1]);
  }

  const inserted = editor.insertBlocks(blocks, targetBlock, "after");
  return blockWithId(inserted[inserted.length - 1]);
}

export function focusPastedBlock(
  editor: Pick<PasteAtCursorEditor, "setTextCursorPosition" | "focus">,
  block: unknown,
): void {
  globalThis.setTimeout(() => {
    try {
      editor.setTextCursorPosition(block, "end");
    } catch {
      // Image and other non-text blocks cannot receive a text cursor.
    }
    editor.focus();
  }, 0);
}
