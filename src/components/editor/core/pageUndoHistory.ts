import { closeHistory, history } from "@tiptap/pm/history";
import { EditorState, Plugin, Selection } from "@tiptap/pm/state";
import { Step } from "@tiptap/pm/transform";
import type { Schema } from "@tiptap/pm/model";

const historyKey = history().spec.key!;

// prosemirror-history 没有序列化 API。这里只适配其 Branch / Item，保留原型和
// 不可变 RopeSequence；Step 必须在新编辑器的 schema 中重建，否则跨 mount
// 撤销图片、列表等结构时会混入旧 schema 的节点。用真实 history 的回归测试约束。
function migrateHistory(value: any, schema: Schema): any {
  const clone = (source: any, fields: object) =>
    Object.assign(Object.create(Object.getPrototypeOf(source)), source, fields);
  const branch = (source: any) => clone(source, {
    items: source.items.slice(0, 0).append(source.items.map((item: any) =>
      clone(item, {
        step: item.step ? Step.fromJSON(schema, item.step.toJSON()) : undefined,
      }),
    )),
  });
  return clone(value, { done: branch(value.done), undone: branch(value.undone) });
}

type Snapshot = {
  signature: string;
  state: EditorState;
};

/** 每个窗口本次运行内共享，最多 10 篇（含当前篇）；不保留编辑器、DOM 或宿主闭包。 */
export class PageUndoHistory {
  private entries = new Map<string, Snapshot | null>();

  private readonly capacity: number;

  constructor(capacity = 10) { this.capacity = capacity; }

  visit(pageId: string) {
    const snapshot = this.entries.get(pageId) ?? null;
    this.entries.delete(pageId);
    this.entries.set(pageId, snapshot);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }

  save(pageId: string, state: EditorState, signature: string) {
    // 非聚焦分屏的卸载不应把已淘汰的笔记重新挤进最近访问列表。
    if (!this.entries.has(pageId)) return;
    const plugin = historyKey.get(state);
    if (!plugin) return;
    this.entries.set(pageId, {
      signature,
      state: state.reconfigure({ plugins: [plugin] }),
    });
  }

  restore(pageId: string, current: EditorState, signature: string): EditorState {
    const snapshot = this.entries.get(pageId);
    this.visit(pageId);
    if (!snapshot) return current;
    if (snapshot.signature !== signature) {
      this.entries.set(pageId, null);
      return current;
    }
    const plugin = historyKey.get(current);
    if (!plugin?.spec.state) return current;
    try {
      const historyState = migrateHistory(historyKey.getState(snapshot.state), current.schema);
      const doc = current.schema.nodeFromJSON(snapshot.state.doc.toJSON());
      const restoredPlugin = new Plugin({
        ...plugin.spec,
        state: { ...plugin.spec.state, init: () => historyState },
      });
      const state = EditorState.create({
        doc,
        selection: Selection.fromJSON(doc, snapshot.state.selection.toJSON()),
        plugins: current.plugins.map((entry) => entry === plugin ? restoredPlugin : entry),
      }).reconfigure({ plugins: current.plugins });
      // 返回后继续输入，应形成新的撤销组。
      return state.apply(closeHistory(state.tr));
    } catch (error) {
      console.error("[goose-note] Could not restore page undo history", error);
      this.entries.set(pageId, null);
      return current;
    }
  }
}

export const pageUndoHistory = new PageUndoHistory();
