import type React from "react";

function getClosestElement(node: Node | null) {
  if (!node) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

function nodeListToCodeText(nodes: ChildNode[]) {
  let text = "";
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node instanceof HTMLBRElement) {
      text += "\n";
      return;
    }
    text += nodeListToCodeText(Array.from(node.childNodes));
  });
  return text;
}

export function getCodeDomSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const codeElement =
    getClosestElement(range.commonAncestorContainer)?.closest<HTMLElement>(
      ".goose-code-content",
    ) ??
    getClosestElement(range.startContainer)?.closest<HTMLElement>(
      ".goose-code-content",
    ) ??
    getClosestElement(range.endContainer)?.closest<HTMLElement>(
      ".goose-code-content",
    );

  if (!codeElement) return null;

  if (
    !codeElement.contains(range.startContainer) ||
    !codeElement.contains(range.endContainer)
  ) {
    return null;
  }

  const beforeStart = document.createRange();
  beforeStart.selectNodeContents(codeElement);
  beforeStart.setEnd(range.startContainer, range.startOffset);

  const beforeEnd = document.createRange();
  beforeEnd.selectNodeContents(codeElement);
  beforeEnd.setEnd(range.endContainer, range.endOffset);

  return {
    codeElement,
    text: nodeListToCodeText(Array.from(codeElement.childNodes)),
    start: nodeListToCodeText(
      Array.from(beforeStart.cloneContents().childNodes),
    ).length,
    end: nodeListToCodeText(Array.from(beforeEnd.cloneContents().childNodes))
      .length,
  };
}

export function isComposingKeyboardEvent(
  event: KeyboardEvent | React.KeyboardEvent,
) {
  return Boolean(
    (event as KeyboardEvent).isComposing ||
    (event as React.KeyboardEvent).nativeEvent?.isComposing,
  );
}

export function setCodeDomSelectionOffsets(
  codeElement: HTMLElement,
  start: number,
  end: number,
) {
  const selection = window.getSelection();
  if (!selection) return;

  let position = 0;

  const findBoundary = (
    parent: Node,
    target: number,
  ): { node: Node; offset: number } | null => {
    const childNodes = Array.from(parent.childNodes);
    for (let index = 0; index < childNodes.length; index += 1) {
      const child = childNodes[index];
      if (child.nodeType === Node.TEXT_NODE) {
        const length = child.textContent?.length ?? 0;
        if (target <= position + length) {
          return { node: child, offset: Math.max(0, target - position) };
        }
        position += length;
        continue;
      }
      if (child instanceof HTMLBRElement) {
        if (target <= position + 1) {
          return { node: parent, offset: index + 1 };
        }
        position += 1;
        continue;
      }
      const nested = findBoundary(child, target);
      if (nested) return nested;
    }
    return null;
  };

  const startBoundary = findBoundary(codeElement, start) ?? {
    node: codeElement,
    offset: codeElement.childNodes.length,
  };
  position = 0;
  const endBoundary = findBoundary(codeElement, end) ?? {
    node: codeElement,
    offset: codeElement.childNodes.length,
  };

  const range = document.createRange();
  range.setStart(startBoundary.node, startBoundary.offset);
  range.setEnd(endBoundary.node, endBoundary.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}
