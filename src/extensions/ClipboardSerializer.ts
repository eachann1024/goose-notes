import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as ProseMirrorNode, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

function serializeNode(node: ProseMirrorNode, depth = 0): string {
  const results: string[] = [];

  if (node.isText) {
    return node.text || "";
  }

  if (node.type.name === "paragraph") {
    const textParts: string[] = [];
    node.forEach((child) => {
      textParts.push(serializeNode(child, depth));
    });
    return textParts.join("");
  }

  if (node.type.name === "heading") {
    const textParts: string[] = [];
    node.forEach((child) => {
      textParts.push(serializeNode(child, depth));
    });
    return textParts.join("");
  }

  if (node.type.name === "bulletList") {
    node.forEach((child) => {
      results.push(serializeNode(child, depth));
    });
    return results.join("\n");
  }

  if (node.type.name === "orderedList") {
    let index = 1;
    node.forEach((child) => {
      const content = serializeListItemContent(child);
      results.push(`${index}. ${content}`);
      index++;
    });
    return results.join("\n");
  }

  if (node.type.name === "taskList") {
    node.forEach((child) => {
      results.push(serializeNode(child, depth));
    });
    return results.join("\n");
  }

  if (node.type.name === "listItem") {
    const content = serializeListItemContent(node);
    return `• ${content}`;
  }

  if (node.type.name === "taskItem") {
    const checked = node.attrs.checked;
    const content = serializeListItemContent(node);
    return `${checked ? "☑" : "☐"} ${content}`;
  }

  if (node.type.name === "blockquote") {
    const textParts: string[] = [];
    node.forEach((child) => {
      textParts.push(serializeNode(child, depth));
    });
    return textParts.map((line) => `> ${line}`).join("\n");
  }

  if (node.type.name === "codeBlock") {
    const textParts: string[] = [];
    node.forEach((child) => {
      textParts.push(serializeNode(child, depth));
    });
    const lang = node.attrs.language || "";
    return `\`\`\`${lang}\n${textParts.join("")}\n\`\`\``;
  }

  if (node.type.name === "horizontalRule") {
    return "---";
  }

  if (node.type.name === "hardBreak") {
    return "\n";
  }

  // Default: serialize children
  node.forEach((child) => {
    results.push(serializeNode(child, depth));
  });

  return results.join("\n");
}

function serializeListItemContent(node: ProseMirrorNode): string {
  const textParts: string[] = [];
  node.forEach((child) => {
    if (child.type.name === "paragraph") {
      child.forEach((grandChild) => {
        textParts.push(serializeNode(grandChild, 0));
      });
    } else {
      textParts.push(serializeNode(child, 0));
    }
  });
  return textParts.join("");
}

function serializeSlice(slice: Slice): string {
  const results: string[] = [];
  slice.content.forEach((node) => {
    results.push(serializeNode(node, 0));
  });
  return results.join("\n");
}

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

export const ClipboardSerializer = Extension.create({
  name: "clipboardSerializer",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("clipboardSerializer"),
        props: {
          clipboardTextSerializer: (slice) => {
            return serializeSlice(slice);
          },
          handleDOMEvents: {
            copy: (view, event) => {
              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc);
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
