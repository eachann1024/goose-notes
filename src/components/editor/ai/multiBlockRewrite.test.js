import { describe, expect, test } from "bun:test";
import { BlockNoteEditor } from "@blocknote/core";
import { Selection, TextSelection, NodeSelection, EditorState } from "prosemirror-state";
import { history, undo } from "@tiptap/pm/history";
import { capturePrivateInlineTarget, preparePrivateInlineDraft, applyPrivateInlineDraft } from "@/lib/notebook-ai/inlineMarkdownApplySelection";
import { GooseAIExtension } from "./GooseAIExtension";
import { getPageInlineRewriteSession } from "./pageInlineRewriteSession";
import { inlineDiffEdges } from "./inlinePreview";
// The bundled class is private and inherits a recursive fromJSON. Capture the
// registered constructor without invoking that inherited decoder, then use create.
function multipleNodeSelection(doc, from, to) {
  const decode = Selection.fromJSON;
  let constructor;
  Selection.fromJSON = function () { constructor = this; return null; };
  try { decode.call(Selection, doc, { type: "multiple-node", anchor: from, head: to }); }
  finally { Selection.fromJSON = decode; }
  return constructor.create(doc, from, to);
}
let counter = 0;
const create = (extensions = []) => BlockNoteEditor.create({ extensions, initialContent: [
  { id: "title", type: "heading", content: "title" },
  { id: "parent", type: "bulletListItem", content: "leftPARENTtail", children: [
    { id: "child", type: "bulletListItem", content: "headCHILDright" },
    { id: "sibling", type: "paragraph", content: "untouched child" },
  ] },
  { id: "last", type: "paragraph", content: "outside" },
] });
function position(e, id) {
  let result;
  e.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === "blockContainer" && node.attrs.id === id) result = { node, pos, from: pos + 2, to: pos + 2 + node.firstChild.content.size };
  });
  return result;
}
function text(e, id) { return e.getBlock(id).content.map((part) => part.text ?? "").join(""); }
function cross(e) {
  const from = position(e, "parent").from + 4;
  const to = position(e, "child").from + 9;
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, from, to)));
  return capturePrivateInlineTarget(e, "parent");
}
describe("multi-block frozen targets", () => {
  test("cross-depth exact payload and partial boundaries, preserves sibling and hierarchy", () => {
    const e = create();
    const target = cross(e);
    expect(target.parts.map((part) => part.node.attrs.id)).toEqual(["parent", "child"]);
    expect(target.parts.map((part) => part.oldMarkdown.trim())).toEqual(["- PARENTtail", "- headCHILD"]);
    expect(target.oldMarkdown).not.toContain("untouched");
    const draft = preparePrivateInlineDraft(e, target, ["rewritten parent", "rewritten child"]);
    const before = e.prosemirrorState.doc;
    expect(text(e, "parent")).toBe("leftPARENTtail");
    applyPrivateInlineDraft(e, target, draft);
    expect(text(e, "parent")).toBe("leftrewritten parent");
    expect(text(e, "child")).toBe("rewritten childright");
    expect(text(e, "sibling")).toBe("untouched child");
    expect(e.getBlock("parent").children.map((block) => block.id)).toEqual(["child", "sibling"]);
    expect(e.prosemirrorState.doc.eq(before)).toBe(false);
  });
  test("whole parent node excludes implicit descendants", () => {
    const e = create();
    const pos = position(e, "parent").pos;
    e.transact((tr) => tr.setSelection(NodeSelection.create(tr.doc, pos)));
    const target = capturePrivateInlineTarget(e, "parent");
    expect(target.sourceBlockIds).toEqual(["parent"]);
    expect(target.oldMarkdown).not.toContain("CHILD");
    applyPrivateInlineDraft(e, target, preparePrivateInlineDraft(e, target, "changed"));
    expect(text(e, "child")).toBe("headCHILDright");
  });
  test("multiple-node range selects siblings without implicitly selecting their children", () => {
    const e = create();
    const last = position(e, "last");
    const anchor = position(e, "parent").pos;
    const selection = multipleNodeSelection(e.prosemirrorState.doc, anchor, last.pos + last.node.nodeSize);
    e.transact((tr) => tr.setSelection(selection));
    const target = capturePrivateInlineTarget(e, "parent");
    expect(target.sourceBlockIds).toEqual(["parent", "last"]);
    const prepared = preparePrivateInlineDraft(e, target, ["new parent", "new last"]);
    applyPrivateInlineDraft(e, target, prepared);
    expect(text(e, "child")).toBe("headCHILDright");
    expect(text(e, "parent")).toBe("new parent");
    expect(text(e, "last")).toBe("new last");
  });
  test("body-wide text selection at block boundaries can preview, accept and undo", () => {
    const e = create();
    e._tiptapEditor.view.updateState(EditorState.create({ doc: e.prosemirrorState.doc, plugins: [...e.prosemirrorState.plugins, history()] }));
    const first = position(e, "parent");
    const last = position(e, "last");
    // The editor's second Cmd+A selects the body at blockGroup boundaries.
    e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, first.pos, last.pos + last.node.nodeSize)));
    const before = e.prosemirrorState.doc;
    const target = capturePrivateInlineTarget(e, "parent");
    expect(target.sourceBlockIds).toEqual(["parent", "child", "sibling", "last"]);
    expect(target.oldMarkdown).not.toContain("title");
    const draft = preparePrivateInlineDraft(e, target, ["new parent", "new child", "new sibling", "new last"]);
    expect(e.prosemirrorState.doc.eq(before)).toBe(true);
    applyPrivateInlineDraft(e, target, draft);
    expect(text(e, "parent")).toBe("new parent");
    expect(text(e, "child")).toBe("new child");
    expect(text(e, "last")).toBe("new last");
    expect(undo(e.prosemirrorState, (tr) => e.prosemirrorView.dispatch(tr))).toBe(true);
    expect(e.prosemirrorState.doc.eq(before)).toBe(true);
  });
  test("backward mixed text/block boundary range keeps partial text private", () => {
    const e = create();
    const first = position(e, "parent");
    const last = position(e, "last");
    e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, last.pos + last.node.nodeSize, first.from + 4)));
    const target = capturePrivateInlineTarget(e, "parent");
    expect(target.sourceBlockIds).toEqual(["parent", "child", "sibling", "last"]);
    expect(target.parts[0].oldMarkdown.trim()).toBe("- PARENTtail");
    applyPrivateInlineDraft(e, target, preparePrivateInlineDraft(e, target, ["A", "B", "C", "D"]));
    expect(text(e, "parent")).toBe("leftA");
  });
  test("block boundary range containing a table still rejects without writing", () => {
    const e = BlockNoteEditor.create({ initialContent: [
      { id: "a", type: "paragraph", content: "before" },
      { id: "t", type: "table", content: { type: "tableContent", rows: [{ cells: ["private table"] }] } },
      { id: "b", type: "paragraph", content: "after" },
    ] });
    const first = position(e, "a"); const last = position(e, "b");
    e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, first.pos, last.pos + last.node.nodeSize)));
    const before = e.prosemirrorState.doc;
    expect(() => capturePrivateInlineTarget(e, "a")).toThrow("表格或非文字块");
    expect(e.prosemirrorState.doc.eq(before)).toBe(true);
  });
  test("unrelated edit before target shifts offsets but does not invalidate acceptance", () => {
    const e = create();
    const target = cross(e);
    const draft = preparePrivateInlineDraft(e, target, ["new parent", "new child"]);
    e.updateBlock("title", { content: "a much longer title" });
    e.updateBlock("sibling", { content: "a changed unselected descendant" });
    applyPrivateInlineDraft(e, target, draft);
    expect(text(e, "title")).toBe("a much longer title");
    expect(text(e, "sibling")).toBe("a changed unselected descendant");
    expect(text(e, "child")).toBe("new childright");
  });
  test("conflict on any selected block rejects the entire batch before writing", () => {
    const e = create(); const target = cross(e);
    const draft = preparePrivateInlineDraft(e, target, ["new parent", "new child"]);
    e.updateBlock("child", { content: "edited" });
    const before = e.prosemirrorState.doc;
    expect(() => applyPrivateInlineDraft(e, target, draft)).toThrow("原文已变化");
    expect(e.prosemirrorState.doc.eq(before)).toBe(true);
  });
  test("all edits occupy one undo event", () => {
    const e = create();
    e._tiptapEditor.view.updateState(EditorState.create({ doc: e.prosemirrorState.doc, plugins: [...e.prosemirrorState.plugins, history()] }));
    const target = cross(e); const before = e.prosemirrorState.doc;
    applyPrivateInlineDraft(e, target, preparePrivateInlineDraft(e, target, ["new parent", "new child"]));
    expect(undo(e.prosemirrorState, (tr) => e.prosemirrorView.dispatch(tr))).toBe(true);
    expect(e.prosemirrorState.doc.eq(before)).toBe(true);
  });
  test("list preview shows list boundaries; empty/mismatched drafts reject", () => {
    const e = create(); const target = capturePrivateInlineTarget(e, "last");
    const draft = preparePrivateInlineDraft(e, target, "- one\n- two");
    expect(draft.edits[0].text).toBe("• one\n• two");
    expect(() => preparePrivateInlineDraft(e, target, "  ")).toThrow("未返回");
    expect(() => preparePrivateInlineDraft(e, cross(e), ["one"])).toThrow("数量不一致");
  });
});
function boundEditor(pageId, scope) {
  const e = create([GooseAIExtension({ getScope: () => ({ pageId, editable: true, protectFirstTitle: true, ...scope }), getSettings: () => ({ enabled: true }) })]);
  const ai = e.getExtension(GooseAIExtension);
  return { e, ai };
}
describe("page session binding", () => {
  test("generation survives detach and replacement, only original page receives draft", async () => {
    const page = `a-${++counter}`;
    const { e, ai } = boundEditor(page);
    cross(e); ai.openAIMenuAtBlock("parent");
    const session = getPageInlineRewriteSession(page);
    let resolve;
    const pending = session.submit("rewrite", () => new Promise((done) => { resolve = done; }));
    ai.detachPage();
    e.replaceBlocks(e.document, [{ id: "b", type: "paragraph", content: "PAGE B" }]);
    resolve("first"); await Promise.resolve(); await Promise.resolve();
    resolve("second"); await pending;
    expect(session.state.status).toBe("user-reviewing");
    expect(ai.store.state.aiMenuState).toBe("closed");
    expect(e.document[0].content[0].text).toBe("PAGE B");
    const returned = boundEditor(page);
    returned.ai.attachPage(page);
    expect(returned.ai.store.state.aiMenuState.status).toBe("user-reviewing");
    returned.ai.acceptChanges();
    expect(text(returned.e, "parent")).toBe("leftfirst");
    expect(text(returned.e, "child")).toBe("secondright");
  });
  test("same-page pane detachment does not close shared draft; locked/deleted scope cannot accept", async () => {
    const page = `split-${++counter}`; const scope = { editable: true };
    const first = boundEditor(page); const second = boundEditor(page, scope);
    first.ai.openAIMenuAtBlock("last");
    const session = getPageInlineRewriteSession(page);
    await session.submit("rewrite", async () => "draft");
    first.ai.detachPage();
    expect(session.state.status).toBe("user-reviewing");
    scope.editable = false;
    second.ai.acceptChanges();
    expect(text(second.e, "last")).toBe("outside");
    expect(session.state.status).toBe("error");
    session.close();
  });
  test("protected first title never opens a writable target", () => {
    const { ai } = boundEditor(`title-${++counter}`);
    ai.openAIMenuAtBlock("title");
    expect(ai.store.state.aiMenuState.status).toBe("error");
  });
  test("diff boundaries do not split emoji", () => {
    expect(inlineDiffEdges("😀a", "😁a")).toEqual({ start: 0, end: 1 });
  });
});
