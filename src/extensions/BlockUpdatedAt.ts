import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const META_BLOCK_UPDATED_AT = "goose-note:block-updated-at";
const DEBOUNCE_MS = 500;

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
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isComposing = false;
    let editorView: EditorView | null = null;

    // 收集"待刷新位置"，防抖期间持续聚合，避免只记录最后一次
    const pendingPositions = new Set<number>();

    const flushPendingUpdate = () => {
      debounceTimer = null;
      if (!editorView || isComposing || pendingPositions.size === 0) return;

      const view = editorView;
      const currentState = view.state;
      const now = Date.now();
      const tr = currentState.tr;
      let changed = false;

      Array.from(pendingPositions)
        .sort((a, b) => a - b)
        .forEach((pos) => {
          if (pos >= currentState.doc.content.size) return;
          const node = tr.doc.nodeAt(pos);
          if (!node || !isTrackedBlock(node.type.name)) return;
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            blockUpdatedAt: now,
          });
          changed = true;
        });

      pendingPositions.clear();

      if (!changed) return;
      tr.setMeta(META_BLOCK_UPDATED_AT, true);
      tr.setMeta("addToHistory", false);
      view.dispatch(tr);
    };

    return [
      new Plugin({
        key: new PluginKey("blockUpdatedAt"),

        view(view) {
          editorView = view;
          const dom = view.dom;

          const onCompositionStart = () => {
            isComposing = true;
            // composition 开始时清掉待执行的防抖，避免在上屏前提交
            if (debounceTimer !== null) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }
          };

          const onCompositionEnd = () => {
            isComposing = false;
            // 上屏完成后，如果还有积压的位置，重新启动防抖
            if (pendingPositions.size > 0) {
              if (debounceTimer !== null) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(flushPendingUpdate, DEBOUNCE_MS);
            }
          };

          dom.addEventListener("compositionstart", onCompositionStart);
          dom.addEventListener("compositionend", onCompositionEnd);

          return {
            destroy() {
              editorView = null;
              dom.removeEventListener("compositionstart", onCompositionStart);
              dom.removeEventListener("compositionend", onCompositionEnd);
              if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
              }
              pendingPositions.clear();
            },
          };
        },

        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (transactions.some((tr) => tr.getMeta(META_BLOCK_UPDATED_AT))) {
            return null;
          }
          // 跳过编辑器初始化/内容装载这类不进历史的事务，避免整页块时间被重刷
          if (
            transactions
              .filter((tr) => tr.docChanged)
              .every((tr) => tr.getMeta("addToHistory") === false)
          ) {
            return null;
          }

          // IME composition 进行中，只收集位置，不派发事务
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
          changedRanges.forEach(({ from, to }) => {
            const safeFrom = Math.max(0, Math.min(from, maxPos));
            const safeTo = Math.max(safeFrom, Math.min(to, maxPos));
            newState.doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
              if (!isTrackedBlock(node.type.name)) return true;
              if (pos < 0) return true;
              pendingPositions.add(pos);
              return true;
            });
          });

          // composition 中不启动 timer，等 compositionend 再拉起
          if (isComposing) return null;

          // 防抖：重置 timer
          if (debounceTimer !== null) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(flushPendingUpdate, DEBOUNCE_MS);

          return null;
        },
      }),
    ];
  },
});
