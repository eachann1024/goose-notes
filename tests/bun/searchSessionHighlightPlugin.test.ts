import { describe, expect, test } from "bun:test";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { searchSessionHighlightKey, searchSessionHighlightPlugin } from "../../src/components/editor/find/searchSessionHighlightPlugin";
import { collectMatches } from "../../src/components/editor/find/findInPagePlugin";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
  },
  marks: { bold: {} },
});

function stateFor(text: string) {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text(text))]);
  return EditorState.create({
    schema,
    doc,
    plugins: [searchSessionHighlightPlugin],
  });
}

describe("search session highlight plugin", () => {
  test("session highlights remain independent from page find plugin state", () => {
    const state = stateFor("needle needle");
    const tr = state.tr.setMeta(searchSessionHighlightKey, { type: "set", query: "needle" });
    const next = state.apply(tr);
    expect(searchSessionHighlightKey.getState(next)?.matches).toHaveLength(2);
    expect(collectMatches(next.doc, "needle", false)).toHaveLength(2);
    const cleared = next.apply(next.tr.setMeta(searchSessionHighlightKey, { type: "clear" }));
    expect(searchSessionHighlightKey.getState(cleared)?.matches).toHaveLength(0);
  });

  test("matches are recomputed after document edits and current match is clamped", () => {
    let state = stateFor("hit hit");
    state = state.apply(state.tr.setMeta(searchSessionHighlightKey, { type: "set", query: "hit" }));
    state = state.apply(state.tr.setMeta(searchSessionHighlightKey, { type: "select", index: 1 }));
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("hit"))]);
    state = state.apply(state.tr.replaceWith(0, state.doc.content.size, doc.content));
    expect(searchSessionHighlightKey.getState(state)).toMatchObject({ matches: [{ from: 1, to: 4 }], current: 0 });
  });
});
