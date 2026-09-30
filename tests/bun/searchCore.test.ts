import { describe, expect, test } from "bun:test";
import { Schema } from "prosemirror-model";
import { collectMatches } from "../../src/components/editor/find/findInPagePlugin";
import { countLiteralMatches, getContentSnippet } from "../../src/pages/workspace/components/command/commandSearchText";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    hard_break: { inline: true, group: "inline", atom: true },
    atom: { inline: true, group: "inline", atom: true },
  },
  marks: { bold: {} },
});

describe("independent search core helpers", () => {
  test("collects consecutive text across marks in the same paragraph, not across blocks", () => {
    const p = (parts: ReturnType<typeof schema.text>[]) => schema.node("paragraph", null, parts);
    const doc = schema.node("doc", null, [
      p([schema.text("Hello "), schema.text("world", [schema.mark("bold")])]),
      p([schema.text("again")]),
    ]);
    expect(collectMatches(doc, "hello world", false)).toHaveLength(1);
    const split = schema.node("doc", null, [p([schema.text("hello")]), p([schema.text(" world")])]);
    expect(collectMatches(split, "hello world", false)).toHaveLength(0);
  });

  test("literal punctuation matching counts exact hits and snippet shows the actual query", () => {
    const text = "Intro\nC++ [草稿] and a.b\nending";
    expect(countLiteralMatches(text, " C++ ")).toBe(1);
    expect(getContentSnippet(text, "[草稿]")?.snippet).toContain("[草稿]");
    expect(getContentSnippet(text, "missing")).toBeUndefined();
  });

  test("keeps a hit near the end of a long line inside the context window", () => {
    const prefix = "前缀".repeat(400);
    const text = `${prefix}这里是目标命中`;
    const result = getContentSnippet(text, "目标命中", 24);
    expect(result?.snippet).toContain("目标命中");
    expect(result?.snippet.startsWith("...")).toBe(true);
    expect(result?.snippet.length).toBeLessThan(80);
  });
});
