import { expect, test } from "playwright/test";
import { Schema } from "@tiptap/pm/model";
import { EditorState, Plugin } from "@tiptap/pm/state";
import { history, undo, redo, undoDepth, redoDepth, closeHistory } from "@tiptap/pm/history";
import { PageUndoHistory } from "../../src/components/editor/core/pageUndoHistory";

function createState(text = "base") {
  const schema = new Schema({ nodes: {
    doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {},
  } });
  return EditorState.create({
    doc: schema.node("doc", null, [schema.node("paragraph", null, text ? schema.text(text) : undefined)]),
    plugins: [history()],
  });
}

test("重建 schema 后仍能撤销结构操作、重做，并重新初始化其他插件", () => {
  const cache = new PageUndoHistory();
  let a = createState();
  a = a.apply(a.tr.insertText(" first", 5));
  a = a.apply(closeHistory(a.tr));
  a = a.apply(a.tr.insert(a.doc.content.size, a.schema.node("paragraph", null, a.schema.text("second"))));
  undo(a, (tr) => { a = a.apply(tr); });
  cache.visit("a");
  cache.save("a", a, "content");
  const transient = new Plugin({ state: { init: () => "fresh", apply: (_, value) => value } });
  const fresh = createState("base first");
  let restored = cache.restore("a", fresh.reconfigure({ plugins: [...fresh.plugins, transient] }), "content");
  expect(restored.schema).toBe(fresh.schema);
  expect(transient.getState(restored)).toBe("fresh");
  expect(undoDepth(restored)).toBe(1);
  expect(redoDepth(restored)).toBe(1);
  redo(restored, (tr) => { restored = restored.apply(tr); });
  expect(restored.doc.childCount).toBe(2);
  expect(restored.doc.lastChild!.type).toBe(fresh.schema.nodes.paragraph);
  undo(restored, (tr) => { restored = restored.apply(tr); });
  undo(restored, (tr) => { restored = restored.apply(tr); });
  expect(restored.doc.textContent).toBe("base");
  redo(restored, (tr) => { restored = restored.apply(tr); });
  expect(restored.doc.textContent).toBe("base first");
});

test("最近 10 篇包含当前篇，重新访问刷新顺序，淘汰后不恢复或串篇", () => {
  const cache = new PageUndoHistory();
  const initial = createState();
  const edited = initial.apply(initial.tr.insertText("edit", 1));
  for (let i = 0; i < 10; i++) {
    cache.visit(String(i));
    cache.save(String(i), edited, "same");
  }
  cache.visit("0");
  cache.visit("10");
  // 被淘汰的后台实例卸载，不能重新挤入缓存。
  cache.save("1", edited, "same");
  expect(undoDepth(cache.restore("0", createState(), "same"))).toBe(1);
  expect(undoDepth(cache.restore("1", createState(), "same"))).toBe(0);
  expect(undoDepth(cache.restore("new", createState(), "same"))).toBe(0);
});

test("外部修改使旧历史失效", () => {
  const cache = new PageUndoHistory();
  let state = createState();
  state = state.apply(state.tr.insertText("edit", 1));
  cache.visit("a");
  cache.save("a", state, "old");
  const fresh = createState("external");
  const restored = cache.restore("a", fresh, "new");
  expect(restored.doc.textContent).toBe("external");
  expect(undoDepth(restored)).toBe(0);
});

test("没有历史快照时直接复用当前 state，调用方无需重建 NodeView", () => {
  const cache = new PageUndoHistory();
  const current = createState("首次打开");
  expect(cache.restore("first-open", current, "same")).toBe(current);
});
