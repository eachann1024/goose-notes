import { expect, test } from "playwright/test";
import {
  isEmptyParagraphBlock,
  shouldOpenInlineAiOnEmptyParagraph,
} from "../../src/components/editor/ai/emptyParagraphAiShortcut";

const emptyParagraph = { type: "paragraph", content: [] as unknown[] };

function base(overrides: Record<string, unknown> = {}) {
  return {
    key: "Enter",
    editable: true,
    aiEnabled: true,
    inEditor: true,
    block: emptyParagraph,
    ...overrides,
  };
}

test("空段落按回车应由编辑器换行，不唤起行内 AI", () => {
  expect(shouldOpenInlineAiOnEmptyParagraph(base())).toBe(false);
});

test("空段落按空格仍可唤起行内 AI", () => {
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ key: " " }))).toBe(true);
});

test("未启用 AI 时不抢空格", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(base({ key: " ", aiEnabled: false })),
  ).toBe(false);
});

test("非空段落空格不唤起", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({
        key: " ",
        block: {
          type: "paragraph",
          content: [{ type: "text", text: "有字" }],
        },
      }),
    ),
  ).toBe(false);
});

test("仅空白文本节点的段落视为空", () => {
  expect(
    isEmptyParagraphBlock({
      type: "paragraph",
      content: [{ type: "text", text: "  " }],
    }),
  ).toBe(true);
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({
        key: " ",
        block: {
          type: "paragraph",
          content: [{ type: "text", text: "" }],
        },
      }),
    ),
  ).toBe(true);
});

test("标题、列表、表格、非空选区、Shift+空格都不抢", () => {
  const space = { key: " " };
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({ ...space, block: { type: "heading", content: [] } }),
    ),
  ).toBe(false);
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({ ...space, block: { type: "bulletListItem", content: [] } }),
    ),
  ).toBe(false);
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ ...space, inTable: true }))).toBe(
    false,
  );
  expect(
    shouldOpenInlineAiOnEmptyParagraph(base({ ...space, selectionEmpty: false })),
  ).toBe(false);
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ ...space, shiftKey: true }))).toBe(
    false,
  );
});
