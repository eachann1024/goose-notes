import { expect, test } from "playwright/test";
import { shouldExpandComposer } from "../../src/components/editor/ai/composer/composerExpandLayout";

test("空内容中的硬换行展开，单行占位 br 不算展开", () => {
  expect(
    shouldExpandComposer({
      isEmpty: true,
      contentWidth: 0,
      slotWidth: 200,
      scrollHeight: 48,
    }),
  ).toBe(true);
  expect(
    shouldExpandComposer({
      isEmpty: true,
      contentWidth: 12,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(false);
});

test("短文本单行能放下时收回", () => {
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 48,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(false);
});

test("内容宽超过单行槽时展开", () => {
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 220,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(true);
});

test("宽度能放下但硬换行撑高时保持展开", () => {
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 48,
      slotWidth: 200,
      scrollHeight: 48,
    }),
  ).toBe(true);
});

test("删回单行或槽变宽后收回", () => {
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 180,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(false);
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 220,
      slotWidth: 280,
      scrollHeight: 24,
    }),
  ).toBe(false);
});

test("贴着槽宽 4px 余量不振荡", () => {
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 196,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(false);
  expect(
    shouldExpandComposer({
      isEmpty: false,
      contentWidth: 197,
      slotWidth: 200,
      scrollHeight: 24,
    }),
  ).toBe(true);
});
