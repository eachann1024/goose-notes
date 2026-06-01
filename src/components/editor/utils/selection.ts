import { normalizeClipboardLineEndings } from "./clipboard";

export function getElementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof HTMLElement) return node;
  return node.parentElement;
}

export function isInteractiveEditorTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "textarea",
        "select",
        "a",
        "[role='button']",
        "[contenteditable='false']",
        "[data-radix-popper-content-wrapper]",
        "[data-notion-slash-root='true']",
        ".bn-side-menu",
        ".bn-formatting-toolbar",
        ".bn-table-handle",
        ".goose-table-extend-button",
        ".goose-code-toolbar-host",
      ].join(","),
    ),
  );
}

export function isBottomEditorBlankClick(
  event: React.MouseEvent<HTMLDivElement> | MouseEvent,
  container: HTMLElement,
): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || !container.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (target.closest(".bn-block-outer, .bn-block-content")) return false;

  const editorSurface = target.closest(
    ".workspace-editor-surface, .bn-container, .bn-root, .bn-editor, .tiptap",
  );
  if (!editorSurface || !container.contains(editorSurface)) return false;

  const blocks = container.querySelectorAll<HTMLElement>(".bn-block-outer");
  const lastBlock = blocks[blocks.length - 1];
  if (!lastBlock) return true;

  return event.clientY >= lastBlock.getBoundingClientRect().bottom;
}

export function getSelectedPlainTextContext(container: HTMLElement): {
  selectedText: string;
  withinCodeBlock: boolean;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const commonAncestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  if (!commonAncestor || !container.contains(commonAncestor)) return null;

  const selectedText = normalizeClipboardLineEndings(selection.toString());
  if (!selectedText) return null;

  const startElement = getElementFromNode(range.startContainer);
  const endElement = getElementFromNode(range.endContainer);
  const withinCodeBlock =
    !!startElement?.closest(".goose-code-block-node") &&
    !!endElement?.closest(".goose-code-block-node");

  return {
    selectedText,
    withinCodeBlock,
  };
}
