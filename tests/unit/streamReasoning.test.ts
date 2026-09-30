import { expect, test } from "playwright/test";
import {
  reasoningDeltaFromChatChoice,
  reasoningDeltaFromResponsesEvent,
} from "../../src/lib/ai-provider/streamReasoning";

test("Chat Completions 抽出 reasoning_content", () => {
  expect(
    reasoningDeltaFromChatChoice({
      reasoning_content: "先看选区",
      content: "正文",
    }),
  ).toBe("先看选区");
});

test("Chat Completions 兼容 reasoning / thinking 字段", () => {
  expect(reasoningDeltaFromChatChoice({ reasoning: "分步" })).toBe("分步");
  expect(reasoningDeltaFromChatChoice({ thinking: "推演" })).toBe("推演");
  expect(reasoningDeltaFromChatChoice({ reasoning: { text: "嵌套" } })).toBe(
    "嵌套",
  );
});

test("Responses 抽出 DeepSeek 的 reasoning_text.delta", () => {
  expect(
    reasoningDeltaFromResponsesEvent({
      type: "response.reasoning_text.delta",
      delta: "用户在列第一周任务",
    }),
  ).toBe("用户在列第一周任务");
});

test("Responses 仍识别 OpenAI 推理摘要事件", () => {
  expect(
    reasoningDeltaFromResponsesEvent({
      type: "response.reasoning_summary_text.delta",
      delta: "摘要",
    }),
  ).toBe("摘要");
});

test("正文增量不当成思考", () => {
  expect(
    reasoningDeltaFromResponsesEvent({
      type: "response.output_text.delta",
      delta: "答案",
    }),
  ).toBe("");
  expect(reasoningDeltaFromChatChoice({ content: "答案" })).toBe("");
});
