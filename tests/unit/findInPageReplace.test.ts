import { BlockNoteEditor } from "@blocknote/core";
import { EditorState } from "prosemirror-state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  createReplaceAllTransaction,
  createReplaceCurrentTransaction,
  findInPageKey,
  findInPagePlugin,
} from "../../src/components/editor/find/findInPagePlugin";

function createDoc(text: string) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "p1",
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ] as any,
  });
}

function stateWithQuery(text: string, query: string, caseSensitive = false) {
  const editor = createDoc(text);
  let state = EditorState.create({
    schema: editor.prosemirrorState.schema,
    doc: editor.prosemirrorState.doc,
    plugins: [findInPagePlugin],
  });
  state = state.apply(
    state.tr.setMeta(findInPageKey, {
      type: "set",
      query,
      caseSensitive,
    }),
  );
  return state;
}

function docText(state: EditorState) {
  return state.doc.textBetween(0, state.doc.content.size, " ");
}

test("替换当前匹配后跳到下一处，其余匹配保留", () => {
  let state = stateWithQuery("foo bar foo", "foo");
  expect(findInPageKey.getState(state)?.matches).toHaveLength(2);
  expect(findInPageKey.getState(state)?.current).toBe(0);

  const tr = createReplaceCurrentTransaction(state, "baz");
  expect(tr).not.toBeNull();
  state = state.apply(tr!);

  expect(docText(state)).toContain("baz bar foo");
  const next = findInPageKey.getState(state);
  expect(next?.matches).toHaveLength(1);
  expect(next?.current).toBe(0);
});

test("全部替换一次改完所有匹配，替换文本含查询词也不会循环", () => {
  let state = stateWithQuery("foo foo foo", "foo");
  expect(findInPageKey.getState(state)?.matches).toHaveLength(3);

  const tr = createReplaceAllTransaction(state, "foofoo");
  expect(tr).not.toBeNull();
  state = state.apply(tr!);

  expect(docText(state)).toContain("foofoo foofoo foofoo");
});

test("没有匹配时替换事务为空", () => {
  const empty = stateWithQuery("hello", "zzz");
  expect(createReplaceCurrentTransaction(empty, "x")).toBeNull();
  expect(createReplaceAllTransaction(empty, "x")).toBeNull();
});
