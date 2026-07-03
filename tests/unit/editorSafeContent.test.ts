import assert from "node:assert/strict";
import { createEditorSafeContent } from "../../src/components/editor/utils/blocknote-content/editorSafeContent";

const inlineSchema = {
  blockSpecs: {
    paragraph: { config: { content: "inline", propSchema: {} } },
    table: { config: { content: "table", propSchema: {} } },
  },
};

const linkedInlineContent = [
  { type: "text", text: "Open " },
  {
    type: "link",
    href: "https://example.com",
    content: [{ type: "text", text: "Example" }],
  },
  { type: "text", text: " now" },
];

const sanitizedParagraph = createEditorSafeContent(
  [{ type: "paragraph", content: linkedInlineContent }],
  inlineSchema,
);

assert.deepEqual(sanitizedParagraph, [
  { type: "paragraph", content: linkedInlineContent },
]);

const sanitizedTable = createEditorSafeContent(
  [
    {
      type: "table",
      content: {
        type: "tableContent",
        rows: [{ cells: [linkedInlineContent] }],
      },
    },
  ],
  inlineSchema,
);

assert.deepEqual(sanitizedTable, [
  {
    type: "table",
    content: {
      type: "tableContent",
      rows: [{ cells: [linkedInlineContent] }],
    },
  },
]);

console.log("editorSafeContent preserves inline links");
process.exit(0);
