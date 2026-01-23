import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
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

// 判断是否在特殊节点内部分选中（Callout、Table 等）
function isPartialSpecialNodeSelection(view: EditorView): boolean {
  const { state } = view;
  const { selection, doc } = state;
  const { $from, $to } = selection;

  // 特殊节点类型
  const specialNodeTypes = ["callout", "table", "tableCell", "tableHeader"];

  // 检查选区是否在特殊节点内部
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (specialNodeTypes.includes(node.type.name)) {
      // 检查是否是完整选中该节点
      const startPos = $from.start(depth);
      const endPos = $from.end(depth);
      const isFullSelection = selection.from === startPos && selection.to === endPos;

      // 如果不是完整选中，则是部分选中
      return !isFullSelection;
    }
  }

  // 检查表格单元格内的部分选中
  let inTableCell = false;
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      const nodeStart = pos;
      const nodeEnd = pos + node.nodeSize;
      // 如果选区不完全覆盖这个单元格
      if (selection.from > nodeStart || selection.to < nodeEnd) {
        inTableCell = true;
      }
    }
  });

  return inTableCell;
}

// 获取纯文本内容（移除所有结构标记）
function getPlainTextContent(view: EditorView): string {
  const { state } = view;
  const { selection, doc } = state;

  let text = "";

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.isText) {
      const start = Math.max(0, selection.from - pos);
      const end = Math.max(0, selection.to - pos);
      text += node.text?.slice(start, end) || "";
    } else if (node.isBlock && text.length > 0 && !text.endsWith("\n")) {
      text += "\n";
    }
  });

  return text.trim();
}

function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function applyCutTransaction(view: EditorView, tr: any) {
  tr.setMeta("uiEvent", "cut");
  tr.setMeta("addToHistory", true);
  view.dispatch(tr);
}

function getTableSelectionText(view: EditorView): string | null {
  const { state } = view;
  const { selection } = state;
  const selectionAny = selection as any;

  if (typeof selectionAny.forEachCell !== "function") {
    return null;
  }

  const rows = new Map<number, string[]>();

  selectionAny.forEachCell((cell: Node, pos: number) => {
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

function findListItemDepth($pos: any): number | null {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "listItem" || node.type.name === "taskItem") {
      return depth;
    }
  }
  return null;
}

function isSingleListItemSelection(view: EditorView): boolean {
  const { selection } = view.state;
  if (selection.empty) return false;

  const fromDepth = findListItemDepth(selection.$from);
  const toDepth = findListItemDepth(selection.$to);

  if (fromDepth === null || toDepth === null) return false;

  const sameListItem =
    selection.$from.start(fromDepth) === selection.$to.start(toDepth) &&
    selection.$from.end(fromDepth) === selection.$to.end(toDepth);

  if (!sameListItem) return false;

  // 整行选中时返回 false，保留列表格式
  const paragraphNode = selection.$from.parent;
  if (paragraphNode.isTextblock) {
    const paragraphStart = selection.$from.start();
    const paragraphEnd = selection.$from.end();
    if (selection.from === paragraphStart && selection.to === paragraphEnd) {
      return false;
    }
  }

  return true;
}

function isSingleTextblockSelection(view: EditorView): boolean {
  const { selection } = view.state;
  if (selection.empty) return false;
  if (selection.$from.parent !== selection.$to.parent) return false;
  return selection.$from.parent.isTextblock;
}

// 检查选区是否包含需要特殊处理的块级节点
function hasSpecialBlockNodes(view: EditorView): boolean {
  const { state } = view;
  const { selection, doc } = state;

  let hasSpecialNode = false;

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (
      node.type.name === "bulletList" ||
      node.type.name === "orderedList" ||
      node.type.name === "taskList" ||
      node.type.name === "blockquote" ||
      node.type.name === "callout"
    ) {
      hasSpecialNode = true;
    }
  });

  return hasSpecialNode;
}

// 自定义序列化列表（避免多余空行）
function serializeList(node: Node, isOrdered: boolean, indent = ""): string {
  let result = "";

  node.forEach((item, _, i) => {
    const prefix = isOrdered ? `${i + 1}. ` : "- ";
    const content = getListItemText(item);
    result += `${indent}${prefix}${content}\n`;

    // 处理嵌套列表
    item.forEach((child) => {
      if (child.type.name === "bulletList") {
        result += serializeList(child, false, indent + "  ");
      } else if (child.type.name === "orderedList") {
        result += serializeList(child, true, indent + "  ");
      } else if (child.type.name === "taskList") {
        result += serializeTaskList(child, indent + "  ");
      }
    });
  });

  return result;
}

// 自定义序列化任务列表（确保有 - [ ] 前缀）
function serializeTaskList(node: Node, indent = ""): string {
  let result = "";

  node.forEach((item) => {
    const checked = item.attrs.checked ? "x" : " ";
    const content = getListItemText(item);
    result += `${indent}- [${checked}] ${content}\n`;

    // 处理嵌套列表
    item.forEach((child) => {
      if (child.type.name === "bulletList") {
        result += serializeList(child, false, indent + "  ");
      } else if (child.type.name === "orderedList") {
        result += serializeList(child, true, indent + "  ");
      } else if (child.type.name === "taskList") {
        result += serializeTaskList(child, indent + "  ");
      }
    });
  });

  return result;
}

// 序列化引用块（避免多余空行）
function serializeBlockquote(node: Node): string {
  const content = node.textContent;
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `> ${line}`)
    .join("\n") + "\n";
}

// 获取列表项文本内容
function getListItemText(item: Node): string {
  let text = "";
  item.forEach((child) => {
    if (child.type.name === "paragraph") {
      text += child.textContent;
    } else if (child.isText) {
      text += child.text || "";
    } else if (child.type.name !== "bulletList" && child.type.name !== "orderedList" && child.type.name !== "taskList") {
      // 非列表子节点
      text += child.textContent;
    }
  });
  return text;
}

// 从 Slice 序列化列表
function serializeSliceList(node: Node, isOrdered: boolean, indent = ""): string {
  let result = "";

  node.forEach((item, _, i) => {
    const prefix = isOrdered ? `${i + 1}. ` : "- ";
    const content = getSliceListItemText(item);
    result += `${indent}${prefix}${content}\n`;

    // 处理嵌套列表
    item.forEach((child) => {
      if (child.type.name === "bulletList") {
        result += serializeSliceList(child, false, indent + "  ");
      } else if (child.type.name === "orderedList") {
        result += serializeSliceList(child, true, indent + "  ");
      } else if (child.type.name === "taskList") {
        result += serializeSliceTaskList(child, indent + "  ");
      }
    });
  });

  return result;
}

// 从 Slice 序列化任务列表
function serializeSliceTaskList(node: Node, indent = ""): string {
  let result = "";

  node.forEach((item) => {
    const checked = item.attrs.checked ? "x" : " ";
    const content = getSliceListItemText(item);
    result += `${indent}- [${checked}] ${content}\n`;

    // 处理嵌套列表
    item.forEach((child) => {
      if (child.type.name === "bulletList") {
        result += serializeSliceList(child, false, indent + "  ");
      } else if (child.type.name === "orderedList") {
        result += serializeSliceList(child, true, indent + "  ");
      } else if (child.type.name === "taskList") {
        result += serializeSliceTaskList(child, indent + "  ");
      }
    });
  });

  return result;
}

// 从 Slice 序列化引用块
function serializeSliceBlockquote(node: Node): string {
  const content = node.textContent;
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `> ${line}`)
    .join("\n") + "\n";
}

// 获取 Slice 列表项文本内容
function getSliceListItemText(item: Node): string {
  let text = "";
  item.forEach((child) => {
    if (child.type.name === "paragraph") {
      text += child.textContent;
    } else if (child.isText) {
      text += child.text || "";
    } else if (child.type.name !== "bulletList" && child.type.name !== "orderedList" && child.type.name !== "taskList") {
      // 非列表子节点
      text += child.textContent;
    }
  });
  return text;
}

// 自定义序列化选区内容
function customSerializeSelection(view: EditorView): string {
  const { state } = view;
  const { selection, doc } = state;

  let markdown = "";
  let prevNodeType = "";

  doc.nodesBetween(selection.from, selection.to, (node, pos, parent) => {
    // 跳过顶层文档节点
    if (node.type.name === "doc") return;

    const nodeStart = pos;
    const nodeEnd = pos + node.nodeSize;

    // 只处理完全在选区内的节点
    if (nodeStart < selection.from || nodeEnd > selection.to) return;

    switch (node.type.name) {
      case "bulletList":
        if (prevNodeType && prevNodeType !== "bulletList") {
          markdown += "\n";
        }
        markdown += serializeList(node, false);
        prevNodeType = "bulletList";
        break;

      case "orderedList":
        if (prevNodeType && prevNodeType !== "orderedList") {
          markdown += "\n";
        }
        markdown += serializeList(node, true);
        prevNodeType = "orderedList";
        break;

      case "taskList":
        if (prevNodeType && prevNodeType !== "taskList") {
          markdown += "\n";
        }
        markdown += serializeTaskList(node);
        prevNodeType = "taskList";
        break;

      case "blockquote":
        if (prevNodeType && prevNodeType !== "blockquote") {
          markdown += "\n";
        }
        markdown += serializeBlockquote(node);
        prevNodeType = "blockquote";
        break;

      case "callout":
        if (prevNodeType) {
          markdown += "\n";
        }
        const emoji = node.attrs.emoji || "💡";
        markdown += `> ${emoji} ${node.textContent}\n`;
        prevNodeType = "callout";
        break;

      case "paragraph":
        if (prevNodeType && prevNodeType !== "paragraph") {
          markdown += "\n";
        }
        markdown += node.textContent + "\n";
        prevNodeType = "paragraph";
        break;

      case "heading":
        if (prevNodeType) {
          markdown += "\n";
        }
        const level = node.attrs.level || 1;
        markdown += `${"#".repeat(level)} ${node.textContent}\n`;
        prevNodeType = "heading";
        break;

      case "horizontalRule":
        if (prevNodeType) {
          markdown += "\n";
        }
        markdown += "---\n";
        prevNodeType = "horizontalRule";
        break;

      case "codeBlock":
        if (prevNodeType) {
          markdown += "\n";
        }
        const lang = node.attrs.language || "";
        markdown += "```" + lang + "\n" + node.textContent + "\n```\n";
        prevNodeType = "codeBlock";
        break;

      default:
        // 其他节点类型，获取文本内容
        if (node.isBlock && node.textContent) {
          if (prevNodeType && prevNodeType !== node.type.name) {
            markdown += "\n";
          }
          markdown += node.textContent + "\n";
          prevNodeType = node.type.name;
        }
    }
  });

  return markdown.trim();
}

export const ClipboardSerializer = Extension.create({
  name: "clipboardSerializer",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("clipboardSerializer"),
        props: {
          // 覆盖 tiptap-markdown 的 clipboardTextSerializer
          clipboardTextSerializer: (slice, view) => {
            // 检查 slice 内容是否包含需要特殊处理的节点
            let hasSpecialNodes = false;
            const hasPartialSpecial = false;

            slice.content.forEach((node) => {
              if (
                node.type.name === "bulletList" ||
                node.type.name === "orderedList" ||
                node.type.name === "taskList" ||
                node.type.name === "blockquote" ||
                node.type.name === "callout"
              ) {
                hasSpecialNodes = true;
              }
            });

            // 对于特殊节点，使用自定义序列化
            if (hasSpecialNodes) {
              // 构造一个临时的 doc 来复用 customSerializeSelection
              // 由于 clipboardTextSerializer 只接收 slice，我们需要创建一个虚拟 view
              // 这里简化处理：直接遍历 slice content 序列化
              let markdown = "";
              let prevNodeType = "";

              slice.content.forEach((node) => {
                switch (node.type.name) {
                  case "bulletList":
                    if (prevNodeType && prevNodeType !== "bulletList") {
                      markdown += "\n";
                    }
                    markdown += serializeSliceList(node, false);
                    prevNodeType = "bulletList";
                    break;

                  case "orderedList":
                    if (prevNodeType && prevNodeType !== "orderedList") {
                      markdown += "\n";
                    }
                    markdown += serializeSliceList(node, true);
                    prevNodeType = "orderedList";
                    break;

                  case "taskList":
                    if (prevNodeType && prevNodeType !== "taskList") {
                      markdown += "\n";
                    }
                    markdown += serializeSliceTaskList(node);
                    prevNodeType = "taskList";
                    break;

                  case "blockquote":
                    if (prevNodeType && prevNodeType !== "blockquote") {
                      markdown += "\n";
                    }
                    markdown += serializeSliceBlockquote(node);
                    prevNodeType = "blockquote";
                    break;

                  case "callout":
                    if (prevNodeType) {
                      markdown += "\n";
                    }
                    const emoji = node.attrs.emoji || "💡";
                    markdown += `> ${emoji} ${node.textContent}\n`;
                    prevNodeType = "callout";
                    break;

                  case "paragraph":
                    if (prevNodeType && prevNodeType !== "paragraph") {
                      markdown += "\n";
                    }
                    markdown += node.textContent + "\n";
                    prevNodeType = "paragraph";
                    break;

                  case "heading":
                    if (prevNodeType) {
                      markdown += "\n";
                    }
                    const level = node.attrs.level || 1;
                    markdown += `${"#".repeat(level)} ${node.textContent}\n`;
                    prevNodeType = "heading";
                    break;

                  case "horizontalRule":
                    if (prevNodeType) {
                      markdown += "\n";
                    }
                    markdown += "---\n";
                    prevNodeType = "horizontalRule";
                    break;

                  case "codeBlock":
                    if (prevNodeType) {
                      markdown += "\n";
                    }
                    const lang = node.attrs.language || "";
                    markdown += "```" + lang + "\n" + node.textContent + "\n```\n";
                    prevNodeType = "codeBlock";
                    break;

                  default:
                    // 其他节点类型
                    if (node.isBlock && node.textContent) {
                      if (prevNodeType && prevNodeType !== node.type.name) {
                        markdown += "\n";
                      }
                      markdown += node.textContent + "\n";
                      prevNodeType = node.type.name;
                    } else if (node.isText) {
                      markdown += node.text || "";
                    }
                }
              });

              return markdown.trim();
            }

            // 其他内容返回空字符串，使用默认处理
            return "";
          },
          handleDOMEvents: {
            copy: (view, event) => {
              // 1. 处理图片复制
              const imageSrc = getSelectedImageSrc(view);
              if (imageSrc) {
                event.preventDefault();
                copyImageToClipboard(imageSrc);
                return true;
              }

              const tableSelectionText = getTableSelectionText(view);
              if (tableSelectionText) {
                event.preventDefault();
                navigator.clipboard.writeText(tableSelectionText);
                return true;
              }

              // 2. 处理代码块复制 - 只复制纯代码内容，不包含 ``` 标记
              const codeBlockText = getCodeBlockTextContent(view);
              if (codeBlockText) {
                event.preventDefault();
                navigator.clipboard.writeText(codeBlockText);
                return true;
              }

              if (isSingleTextblockSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText);
                  return true;
                }
              }

              // 3. 处理特殊节点内部的部分选中（Callout、Table 等）
              // 只复制纯文本，不带结构标记
              if (isPartialSpecialNodeSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText);
                  return true;
                }
              }

              if (isSingleListItemSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText);
                  return true;
                }
              }

              // 4. 处理多行/多块选中（列表、标题、引用等）
              // 使用自定义序列化，保留格式
              const markdown = customSerializeSelection(view);
              if (markdown) {
                event.preventDefault();
                navigator.clipboard.writeText(markdown);
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

              // 处理特殊节点内部的部分选中
              if (isPartialSpecialNodeSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText).then(() => {
                    const { state } = view;
                    const tr = state.tr.deleteSelection();
                    applyCutTransaction(view, tr);
                  });
                  return true;
                }
              }

              if (isSingleTextblockSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText).then(() => {
                    const { state } = view;
                    const tr = state.tr.deleteSelection();
                    applyCutTransaction(view, tr);
                  });
                  return true;
                }
              }

              if (isSingleListItemSelection(view)) {
                const plainText = getPlainTextContent(view);
                if (plainText) {
                  event.preventDefault();
                  navigator.clipboard.writeText(plainText).then(() => {
                    const { state } = view;
                    const tr = state.tr.deleteSelection();
                    applyCutTransaction(view, tr);
                  });
                  return true;
                }
              }

              // 处理完整节点选中
              if (hasSpecialBlockNodes(view)) {
                const markdown = customSerializeSelection(view);
                if (markdown) {
                  event.preventDefault();
                  navigator.clipboard.writeText(markdown).then(() => {
                    const { state } = view;
                    const tr = state.tr.deleteSelection();
                    applyCutTransaction(view, tr);
                  });
                  return true;
                }
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
