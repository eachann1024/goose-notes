import { describe, expect, test } from "bun:test";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import {
  captureInlineSelection,
  composeInlineReplacement,
} from "./selectionPrivacy";
const schema = new Schema({
  nodes: {
    doc: { content: "blockGroup" },
    blockGroup: { content: "blockContainer+" },
    blockContainer: {
      content: "blockContent blockGroup?",
      attrs: { id: { default: null } },
    },
    paragraph: { content: "inline*", group: "blockContent" },
    bulletListItem: { content: "inline*", group: "blockContent" },
    text: { group: "inline" },
  },
  marks: { bold: {}, link: { attrs: { href: {} } } },
});
const text = (value) => (value ? schema.text(value) : undefined);
const block = (id, value, type = "paragraph") =>
  schema.node("blockContainer", { id }, schema.node(type, null, text(value)));
const doc = (...blocks) =>
  schema.node("doc", null, schema.node("blockGroup", null, blocks));
const apply = (source, from, to, generated) => {
  const target = captureInlineSelection(source, from, to);
  return EditorState.create({ doc: source }).tr.replaceWith(
    target.replaceFrom,
    target.replaceTo,
    composeInlineReplacement(target, generated),
  ).doc;
};
describe("private inline character replacement", () => {
  test("only selected characters are serialized, including a partial word", () => {
    const source = doc(block("a", "secretHELLOprivate"));
    const target = captureInlineSelection(source, 9, 14);
    expect(target.selectedNodes.map((node) => node.textContent)).toEqual([
      "HELLO",
    ]);
    expect(apply(source, 9, 14, [block("new", "你好")]).textContent).toBe(
      "secret你好private",
    );
    expect(source.textContent).toBe("secretHELLOprivate");
  });
  test("outside bold and link marks survive replacement", () => {
    const content = schema.node("paragraph", null, [
      schema.text("before", [schema.marks.bold.create()]),
      schema.text("rewrite"),
      schema.text("after", [
        schema.marks.link.create({ href: "https://example.com" }),
      ]),
    ]);
    const source = doc(schema.node("blockContainer", { id: "a" }, content));
    const output = apply(source, 9, 16, [block("new", "OK")]);
    expect(
      output.firstChild.firstChild.firstChild.firstChild.marks[0].type.name,
    ).toBe("bold");
    expect(
      output.firstChild.firstChild.firstChild.lastChild.marks[0].attrs.href,
    ).toBe("https://example.com");
    expect(output.textContent).toBe("beforeOKafter");
  });
  test("structural lists split only selected text and keep both boundaries", () => {
    const source = doc(
      block("a", "prefixselectedsuffix"),
      block("b", "untouched"),
    );
    const output = apply(source, 9, 17, [
      block("x", "one", "bulletListItem"),
      block("y", "two", "bulletListItem"),
    ]);
    expect(output.firstChild.childCount).toBe(5);
    expect(output.firstChild.child(0).textContent).toBe("prefix");
    expect(output.firstChild.child(1).firstChild.type.name).toBe(
      "bulletListItem",
    );
    expect(output.firstChild.child(3).textContent).toBe("suffix");
    expect(output.firstChild.child(4).eq(source.firstChild.child(1))).toBe(
      true,
    );
    expect(output.firstChild.child(3).attrs.id).not.toBe("a");
  });
  test("cross-block selection preserves unselected endpoints and following block", () => {
    const source = doc(
      block("a", "prefixAAA"),
      block("b", "BBBsuffix"),
      block("c", "private"),
    );
    const target = captureInlineSelection(source, 9, 19);
    expect(target.selectedNodes.map((node) => node.textContent)).toEqual([
      "AAA",
      "BBB",
    ]);
    const output = apply(source, 9, 19, [block("new", "rewritten")]);
    expect(output.textContent).toBe("prefixrewrittensuffixprivate");
  });
  test("cursor target does not disclose or replace nested children", () => {
    const parent = schema.node("blockContainer", { id: "a" }, [
      schema.node("paragraph", null, text("parent")),
      schema.node("blockGroup", null, block("child", "private descendant")),
    ]);
    const source = doc(parent);
    const target = captureInlineSelection(source, 3, 9);
    expect(target.selectedNodes[0].textContent).toBe("parent");
    const output = apply(source, 3, 9, [block("new", "changed")]);
    expect(output.firstChild.firstChild.child(1).eq(parent.child(1))).toBe(
      true,
    );
  });
  test("empty paragraph can generate a list", () => {
    const source = doc(block("a", ""));
    const output = apply(source, 3, 3, [
      block("x", "one", "bulletListItem"),
      block("y", "two", "bulletListItem"),
    ]);
    expect(output.firstChild.childCount).toBe(2);
  });
  test("cross-depth selections fail closed", () => {
    const parent = schema.node("blockContainer", { id: "a" }, [
      schema.node("paragraph", null, text("parent")),
      schema.node("blockGroup", null, block("child", "child")),
    ]);
    expect(() => captureInlineSelection(doc(parent), 3, 15)).toThrow("跨层级");
  });
});
