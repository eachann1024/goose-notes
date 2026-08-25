import { expect, test } from "playwright/test";
import { pageHasMermaidBlock } from "../../src/lib/imageExport/loadMermaid";

test("pageHasMermaidBlock 能扫到嵌套 mermaid 代码块", () => {
  expect(pageHasMermaidBlock(undefined)).toBe(false);
  expect(pageHasMermaidBlock([])).toBe(false);
  expect(
    pageHasMermaidBlock([
      { type: "paragraph", content: [{ type: "text", text: "hi" }] },
    ]),
  ).toBe(false);
  expect(
    pageHasMermaidBlock([
      {
        type: "codeBlock",
        props: { language: "mermaid" },
        content: "flowchart LR\nA-->B",
      },
    ]),
  ).toBe(true);
  expect(
    pageHasMermaidBlock([
      {
        type: "toggleListItem",
        content: [{ type: "text", text: "折" }],
        children: [
          {
            type: "codeBlock",
            props: { language: "mermaid" },
            content: "flowchart LR\nA-->B",
          },
        ],
      },
    ]),
  ).toBe(true);
});
