import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

async function copyImageToClipboard(src: string): Promise<boolean> {
  try {
    let blob: Blob;

    if (src.startsWith("data:")) {
      // Base64 data URL
      const response = await fetch(src);
      blob = await response.blob();
    } else {
      // Remote URL
      const response = await fetch(src);
      blob = await response.blob();
    }

    // Convert to PNG if needed (clipboard API prefers PNG)
    if (blob.type !== "image/png") {
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (pngBlob) {
          blob = pngBlob;
        }
      }
      URL.revokeObjectURL(img.src);
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);

    return true;
  } catch (err) {
    console.error("Failed to copy image:", err);
    return false;
  }
}

function getSelectedImageSrc(view: EditorView): string | null {
  const { state } = view;
  const { selection } = state;

  // Check if a node is selected
  if (selection.empty) return null;

  const node = state.doc.nodeAt(selection.from);
  if (node?.type.name === "image" || node?.type.name === "imageResize") {
    return node.attrs.src;
  }

  // Check NodeSelection
  if (selection instanceof NodeSelection) {
    const selectedNode = selection.node;
    if (
      selectedNode.type.name === "image" ||
      selectedNode.type.name === "imageResize"
    ) {
      return selectedNode.attrs.src;
    }
  }

  return null;
}

function writePlainTextToClipboard(event: Event, text: string): boolean {
  const clipboardEvent = event as ClipboardEvent;
  const clipboardData = clipboardEvent.clipboardData;

  if (clipboardData) {
    clipboardData.setData("text/plain", text);
    return true;
  }

  try {
    UToolsAdapter.copyToClipboard(text);
    return true;
  } catch (err) {
    console.error("Failed to copy plain text:", err);
    return false;
  }
}

function getSelectedCodeBlockText(view: EditorView): string | null {
  const { state } = view;
  const { selection } = state;

  if (selection instanceof NodeSelection) {
    const selectedNode = selection.node;
    if (selectedNode?.type?.name === "codeBlock") {
      return selectedNode.textContent || "";
    }
  }

  const inCodeBlock =
    selection.$from.parent.type.name === "codeBlock" &&
    selection.$to.parent.type.name === "codeBlock" &&
    selection.$from.sameParent(selection.$to);

  if (!inCodeBlock) return null;

  if (selection.empty) {
    return selection.$from.parent.textContent || "";
  }

  return selection.$from.parent.textBetween(
    selection.$from.parentOffset,
    selection.$to.parentOffset,
    undefined,
    "\n",
  );
}

function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function applyCutTransaction(view: EditorView, tr: Transaction) {
  tr.setMeta("uiEvent", "cut");
  tr.setMeta("addToHistory", true);
  view.dispatch(tr);
}

function getTableSelectionText(view: EditorView): string | null {
  const { state } = view;
  const { selection } = state;
  const tableSelection = selection as {
    forEachCell?: (callback: (cell: Node, pos: number) => void) => void;
  };

  if (typeof tableSelection.forEachCell !== "function") {
    return null;
  }

  const rows = new Map<number, string[]>();

  tableSelection.forEachCell((cell: Node, pos: number) => {
    const $pos = state.doc.resolve(pos);
    let rowKey = pos;

    for (let depth = $pos.depth; depth >= 0; depth--) {
      if ($pos.node(depth).type.name === "tableRow") {
        rowKey = $pos.before(depth);
        break;
      }
    }

    const row = rows.get(rowKey) ?? [];
    const cellText = normalizePlainText(cell.textContent);
    if (cellText) {
      row.push(cellText);
    }
    rows.set(rowKey, row);
  });

  if (!rows.size) return null;

  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, cells]) => cells.join(" ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export const ClipboardSerializer = Extension.create({
  name: "clipboardSerializer",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("clipboardSerializer"),
        props: {
          handleDOMEvents: {
            copy: (view, event) => {
              const codeBlockText = getSelectedCodeBlockText(view);
              if (codeBlockText !== null) {
                event.preventDefault();
                const copied = writePlainTextToClipboard(event, codeBlockText);
                if (!copied) {
                  Promise.resolve()
                    .then(() => UToolsAdapter.copyToClipboard(codeBlockText))
                    .catch((err) => {
                    console.error("Failed to copy code block:", err);
                  });
                }
                return true;
              }

              // 1. 处理图片复制
              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc);
                return true;
              }

              // 2. 处理表格复制 - 优先作为纯文本表格 (Excel 兼容)
              // 如果不想拦截，可以移除这段，让 tiptap-markdown 处理为 Markdown 表格
              const tableSelectionText = getTableSelectionText(view);
              if (tableSelectionText) {
                event.preventDefault();
                UToolsAdapter.copyToClipboard(tableSelectionText);
                return true;
              }

              // 3. 其他情况返回 false，交给 tiptap-markdown 处理
              return false;
            },
            cut: (view, event) => {
              const codeBlockText = getSelectedCodeBlockText(view);
              if (codeBlockText !== null) {
                event.preventDefault();
                const copied = writePlainTextToClipboard(event, codeBlockText);

                if (copied) {
                  const { state } = view;
                  const tr = state.tr.deleteSelection();
                  applyCutTransaction(view, tr);
                } else {
                  navigator.clipboard.writeText(codeBlockText).then(() => {
                    const { state } = view;
                    const tr = state.tr.deleteSelection();
                    applyCutTransaction(view, tr);
                  }).catch((err) => {
                    console.error("Failed to cut code block:", err);
                  });
                }
                return true;
              }

              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc).then(
                  (success) => {
                    if (success) {
                      // Delete the image after copying
                      const { state } = view;
                      const tr = state.tr.deleteSelection();
                      applyCutTransaction(view, tr);
                    }
                  },
                );
                return true;
              }

              const tableSelectionText = getTableSelectionText(view);
              if (tableSelectionText) {
                event.preventDefault();
                navigator.clipboard.writeText(tableSelectionText).then(() => {
                  const { state } = view;
                  const tr = state.tr.deleteSelection();
                  applyCutTransaction(view, tr);
                });
                return true;
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
