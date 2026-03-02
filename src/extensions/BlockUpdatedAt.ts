import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

const META_BLOCK_UPDATED_AT = "goose-note:block-updated-at";

const TRACKED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "callout",
  "horizontalRule",
  "codeBlock",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
]);

function isTrackedBlock(typeName: string): boolean {
  return TRACKED_BLOCK_TYPES.has(typeName);
}

export const BlockUpdatedAt = Extension.create({
  name: "blockUpdatedAt",

  addGlobalAttributes() {
    return [
      {
        types: Array.from(TRACKED_BLOCK_TYPES),
        attributes: {
          blockUpdatedAt: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-block-updated-at");
              if (!raw) return null;
              const parsed = Number(raw);
              return Number.isFinite(parsed) ? parsed : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.blockUpdatedAt) return {};
              return {
                "data-block-updated-at": String(attributes.blockUpdatedAt),
              };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (transactions.some((tr) => tr.getMeta(META_BLOCK_UPDATED_AT))) {
            return null;
          }
          // 跳过编辑器初始化/内容装载这类不进历史的事务，避免整页块时间被重刷。
          if (
            transactions.some((tr) => tr.docChanged) &&
            transactions
              .filter((tr) => tr.docChanged)
              .every((tr) => tr.getMeta("addToHistory") === false)
          ) {
            return null;
          }

          const changedRanges: Array<{ from: number; to: number }> = [];

          transactions.forEach((tr) => {
            tr.mapping.maps.forEach((stepMap) => {
              stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                changedRanges.push({
                  from: Math.max(0, Math.min(newStart, newEnd) - 1),
                  to: Math.max(newStart, newEnd) + 1,
                });
              });
            });
          });

          if (changedRanges.length === 0) {
            const pos = newState.selection.from;
            changedRanges.push({ from: Math.max(0, pos - 1), to: pos + 1 });
          }

          const maxPos = newState.doc.content.size;
          const now = Date.now();
          const touched = new Set<number>();

          changedRanges.forEach(({ from, to }) => {
            const safeFrom = Math.max(0, Math.min(from, maxPos));
            const safeTo = Math.max(safeFrom, Math.min(to, maxPos));

            newState.doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
              if (!isTrackedBlock(node.type.name)) return true;
              if (pos < 0) return true;
              touched.add(pos);
              return true;
            });
          });

          if (touched.size === 0) return null;

          const tr = newState.tr;
          let changed = false;

          Array.from(touched)
            .sort((a, b) => a - b)
            .forEach((pos) => {
              const node = tr.doc.nodeAt(pos);
              if (!node) return;
              if (!isTrackedBlock(node.type.name)) return;

              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockUpdatedAt: now,
              });
              changed = true;
            });

          if (!changed) return null;

          tr.setMeta(META_BLOCK_UPDATED_AT, true);
          tr.setMeta("addToHistory", false);
          return tr;
        },
      }),
    ];
  },
});
