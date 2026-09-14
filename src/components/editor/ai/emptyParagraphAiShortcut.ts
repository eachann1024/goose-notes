/**
 * 空白段落唤起行内 AI。
 * 主窗口：回车或空格；速记小窗：只认空格，回车继续换行。
 * 表格单元格、非空段落、修饰键、IME 合成中都不抢。
 */

export function isInlineAiEmptyParagraphTriggerKey(
  key: string,
  allowEnter = true,
): boolean {
  if (key === " ") return true;
  return allowEnter && key === "Enter";
}

function isEmptyParagraphContent(content: unknown): boolean {
  if (content === "" || content == null) return true;
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

export function isEmptyParagraphBlock(block: {
  type?: string;
  content?: unknown;
  children?: unknown[];
} | null | undefined): boolean {
  if (!block || block.type !== "paragraph") return false;
  if (Array.isArray(block.children) && block.children.length > 0) return false;
  return isEmptyParagraphContent(block.content);
}

export function shouldOpenInlineAiOnEmptyParagraph(input: {
  key: string;
  allowEnter?: boolean;
  defaultPrevented?: boolean;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  editable: boolean;
  aiEnabled: boolean;
  inEditor: boolean;
  inTable?: boolean;
  selectionEmpty?: boolean;
  block: {
    type?: string;
    content?: unknown;
    children?: unknown[];
  } | null;
}): boolean {
  if (
    !isInlineAiEmptyParagraphTriggerKey(input.key, input.allowEnter !== false)
  ) {
    return false;
  }
  if (input.defaultPrevented || input.repeat) return false;
  if (input.altKey || input.ctrlKey || input.metaKey || input.shiftKey) {
    return false;
  }
  if (input.isComposing || !input.editable || !input.aiEnabled) return false;
  if (!input.inEditor || input.inTable || input.selectionEmpty === false) {
    return false;
  }
  return isEmptyParagraphBlock(input.block);
}
