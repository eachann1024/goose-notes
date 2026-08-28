import { expect, test } from "playwright/test";
import {
  getSoleFileReferencePageId,
  resolveEmptySessionComposerSeed,
  shouldSeedCurrentPageReference,
} from "../../src/pages/workspace/components/notebook-ai/defaultComposerReference";
import { inspectDefaultComposerTokens } from "../../src/components/editor/ai/composer/composerTokens";

const textDraft = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "用户尚未发送的内容" }],
    },
  ],
};

const oldPageReference = {
  pageId: "page-old",
  workspaceId: "nb-a",
  titleSnapshot: "旧笔记.md",
  sourceType: "local-file" as const,
};

const newPageReference = {
  pageId: "page-new",
  workspaceId: "nb-b",
  titleSnapshot: "新笔记.md",
  sourceType: "local-file" as const,
};

const soleReferenceDraft = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "aiFileReference", attrs: oldPageReference }],
    },
  ],
};

test("空会话且无草稿时注入当前笔记", () => {
  expect(shouldSeedCurrentPageReference(0, null)).toBe(true);
  expect(shouldSeedCurrentPageReference(0, null, "page-new")).toBe(true);
});

test("已有消息的会话不修改输入区", () => {
  expect(shouldSeedCurrentPageReference(1, null)).toBe(false);
  expect(
    shouldSeedCurrentPageReference(1, soleReferenceDraft, "page-new"),
  ).toBe(false);
});

test("空会话已有用户草稿时不覆盖", () => {
  expect(shouldSeedCurrentPageReference(0, textDraft)).toBe(false);
  expect(shouldSeedCurrentPageReference(0, textDraft, "page-new")).toBe(false);
});

test("空会话只剩自动植入的旧 @ 时跟随当前页", () => {
  expect(getSoleFileReferencePageId(soleReferenceDraft)).toBe("page-old");
  expect(
    shouldSeedCurrentPageReference(0, soleReferenceDraft, "page-new"),
  ).toBe(true);
  expect(
    shouldSeedCurrentPageReference(0, soleReferenceDraft, "page-old"),
  ).toBe(false);
});

test("打开空会话时把旧默认 @ 换成当前笔记", () => {
  const seed = resolveEmptySessionComposerSeed(
    0,
    soleReferenceDraft,
    newPageReference,
  );
  expect(getSoleFileReferencePageId(seed)).toBe("page-new");
});

test("输入区只有默认 @ 才允许替换，用户文本则跳过", () => {
  expect(
    inspectDefaultComposerTokens([
      { type: "reference", reference: oldPageReference },
    ]),
  ).toEqual({ replaceable: true, solePageId: "page-old" });
  expect(
    inspectDefaultComposerTokens([
      { type: "reference", reference: oldPageReference },
      { type: "text", text: "帮我总结" },
    ]),
  ).toEqual({ replaceable: false, solePageId: null });
});
