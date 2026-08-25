import { expect, test } from "playwright/test";
import {
  clipPinnedTitle,
  PINNED_TITLE_MAX_CHARS,
} from "../../src/components/editor/utils/page-title";

test("置顶名称固定截 4 个字且不加省略号", () => {
  expect(PINNED_TITLE_MAX_CHARS).toBe(4);
  expect(clipPinnedTitle("置顶 2")).toBe("置顶 2");
  expect(clipPinnedTitle("置顶两项")).toBe("置顶两项");
  expect(clipPinnedTitle("Agent 总体架构")).toBe("Agen");
  expect(clipPinnedTitle("未命名")).toBe("未命名");
  expect(clipPinnedTitle("")).toBe("");
});
