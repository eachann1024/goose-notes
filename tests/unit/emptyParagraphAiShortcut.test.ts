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

test("空段落按回车应唤起行内 AI", () => {
  expect(shouldOpenInlineAiOnEmptyParagraph(base())).toBe(true);
});

test("空段落按空格仍可唤起行内 AI", () => {
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ key: " " }))).toBe(true);
});

test("速记小窗空段落按回车不唤起 AI", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(base({ allowEnter: false })),
  ).toBe(false);
});

test("速记小窗空段落按空格仍唤起 AI", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({ key: " ", allowEnter: false }),
    ),
  ).toBe(true);
});

test("未启用 AI 时不抢回车", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(base({ aiEnabled: false })),
  ).toBe(false);
});

test("非空段落回车不唤起", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({
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
        block: {
          type: "paragraph",
          content: [{ type: "text", text: "" }],
        },
      }),
    ),
  ).toBe(true);
});

test("标题、列表、表格、非空选区、Shift+Enter 都不抢", () => {
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({ block: { type: "heading", content: [] } }),
    ),
  ).toBe(false);
  expect(
    shouldOpenInlineAiOnEmptyParagraph(
      base({ block: { type: "bulletListItem", content: [] } }),
    ),
  ).toBe(false);
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ inTable: true }))).toBe(
    false,
  );
  expect(
    shouldOpenInlineAiOnEmptyParagraph(base({ selectionEmpty: false })),
  ).toBe(false);
  expect(shouldOpenInlineAiOnEmptyParagraph(base({ shiftKey: true }))).toBe(
    false,
  );
});
