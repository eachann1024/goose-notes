import { expect, test } from "playwright/test";
import {
  resolveInlineBusyTicker,
  visibleBusyTickerLine,
  composeInlineBusyTicker,
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

test("compose 把思考压成一行，不把正文混进去", () => {
  expect(
    composeInlineBusyTicker({
      reasoningText: "是周一？\n8.31 是周一，完美一周。所以改标题",
      text: "## 第一周 8.31 - 9.4",
    }),
  ).toBe("所以改标题");
});

test("多段工具间思考也只留最后一句，给工作卡行内用", () => {
  expect(
    visibleBusyTickerLine(
      ["先读当前笔记。", "对照适配点。", "轻度原生化就是少套壳"].join("\n"),
    ),
  ).toBe("轻度原生化就是少套壳");
});
