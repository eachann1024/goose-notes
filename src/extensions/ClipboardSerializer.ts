import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

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
  const nodeSelection = selection as any;
  if (nodeSelection.node) {
    const selectedNode = nodeSelection.node;
    if (
      selectedNode.type.name === "image" ||
      selectedNode.type.name === "imageResize"
    ) {
      return selectedNode.attrs.src;
    }
  }

  return null;
}

function getCodeBlockTextContent(view: EditorView): string | null {
  const { state } = view;
  const { selection, doc } = state;

  if (selection.empty) return null;

  let text = "";
  let hasCodeBlock = false;

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.type.name === "codeBlock") {
      hasCodeBlock = true;
      // 计算选中范围与代码块节点的交集
      const start = Math.max(pos, selection.from) - pos - 1;
      const end = Math.min(pos + node.nodeSize, selection.to) - pos - 1;
      text += node.textContent.slice(Math.max(0, start), Math.max(0, end));
    } else if (!hasCodeBlock) {
      text += node.textContent;
    }
  });

  return hasCodeBlock ? text : null;
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
              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc);
                return true;
              }

              // 处理代码块复制 - 只复制纯代码内容，不包含 ``` 标记
              const codeBlockText = getCodeBlockTextContent(view);
              if (codeBlockText) {
                event.preventDefault();
                navigator.clipboard.writeText(codeBlockText);
                return true;
              }

              return false;
            },
            cut: (view, event) => {
              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc).then(
                  (success) => {
                    if (success) {
                      // Delete the image after copying
                      const { state, dispatch } = view;
                      const tr = state.tr.deleteSelection();
                      dispatch(tr);
                    }
                  },
                );
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
