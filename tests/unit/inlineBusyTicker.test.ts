import { expect, test } from "playwright/test";
import {
  resolveInlineBusyTicker,
  visibleBusyTickerLine,
} from "../../src/components/editor/ai/inlineBusyTicker";

test("有思考时只用思考，不混入正文", () => {
  expect(
    resolveInlineBusyTicker({
      reasoningText: "先看选区语气\n再改成口语",
      text: "- 改写后的列表",
    }),
  ).toBe("先看选区语气\n再改成口语");
});

test("思考还是空白时，用正在生成的正文填 ticker", () => {
  expect(
    resolveInlineBusyTicker({
      reasoningText: "   ",
      text: "正在落笔的句子",
    }),
  ).toBe("正在落笔的句子");
});

test("两者都空则返回空串，交给 placeholder", () => {
  expect(resolveInlineBusyTicker({})).toBe("");
  expect(resolveInlineBusyTicker({ reasoningText: "", text: "" })).toBe("");
});

test("展示行只留最后一句，旧思考被盖住", () => {
  expect(visibleBusyTickerLine("先检索笔记。\n再读 28 号那天")).toBe(
    "再读 28 号那天",
  );
  expect(visibleBusyTickerLine("第一句。第二句！第三句")).toBe("第三句");
  expect(visibleBusyTickerLine("")).toBe("");
});
