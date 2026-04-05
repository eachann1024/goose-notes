import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { classifyIntent } from "../src/lib/ai-intent-router";
import type { AISettingsLike } from "../src/lib/ai-provider";

const runAITextMock = vi.fn();

vi.mock("../src/lib/ai-provider", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/ai-provider")>("../src/lib/ai-provider");
  return {
    ...actual,
    runAIText: runAITextMock,
  };
});

const settings: AISettingsLike = {
  enabled: true,
  selectedModelId: "model-1",
  workspaceReasoningLevel: "high",
  useCustomProvider: true,
  customProtocol: "openai",
  customOpenAIBaseURL: "https://example.com/v1",
  customClaudeBaseURL: "https://example.com/v1",
  customOpenAIApiKey: "key",
  customClaudeApiKey: "key",
  customModelOptions: [{ id: "model-1", label: "Model 1" }],
};

const context = {
  userMessage: "帮我改短一点",
  recentMessages: [
    { role: "user" as const, summary: "请写一篇项目周报" },
    { role: "assistant" as const, summary: "已经生成了一版项目周报" },
  ],
  currentPageTitle: "当前页",
  currentNotebookName: "工作台",
  lastWrittenPageTitle: "周报草稿",
  lastAssistantAction: "wrote_content" as const,
};

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runAITextMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("合法 JSON 返回 llm 分类结果", async () => {
    runAITextMock.mockResolvedValue(
      '{"verdict":"edit_current","confidence":0.91,"reason":"follow_up_edit"}',
    );

    const result = await classifyIntent(settings, context);

    expect(result).toEqual({
      verdict: "edit_current",
      confidence: 0.91,
      reason: "follow_up_edit",
      source: "llm",
    });
    expect(runAITextMock).toHaveBeenCalledWith(
      settings,
      [
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Current page: 当前页"),
        }),
      ],
      {
        abortSignal: expect.any(AbortSignal),
        requestOverrides: {
          selectedModelId: "model-1",
          reasoningLevel: "default",
        },
      },
    );
    const prompt = runAITextMock.mock.calls[0][1][1].content as string;
    expect(prompt).toContain("Current page: 当前页");
    expect(prompt).toContain("Notebook: 工作台");
    expect(prompt).toContain("Last written page: 周报草稿");
    expect(prompt).toContain("Last assistant action: wrote_content");
    expect(prompt).toContain("user: 请写一篇项目周报");
    expect(prompt).toContain("assistant: 已经生成了一版项目周报");
  });

  test("markdown code fence JSON 仍可解析", async () => {
    runAITextMock.mockResolvedValue(
      '```json\n{"verdict":"create_new","confidence":0.8,"reason":"explicit_create"}\n```',
    );

    await expect(classifyIntent(settings, context)).resolves.toMatchObject({
      verdict: "create_new",
      confidence: 0.8,
      reason: "explicit_create",
      source: "llm",
    });
  });

  test("非法 JSON 返回 parse_error fallback", async () => {
    runAITextMock.mockResolvedValue("not json");

    await expect(classifyIntent(settings, context)).resolves.toEqual({
      verdict: "chat_only",
      confidence: 0,
      reason: "parse_error",
      source: "fallback",
    });
  });

  test("非法 verdict 返回 parse_error fallback", async () => {
    runAITextMock.mockResolvedValue(
      '{"verdict":"unknown","confidence":0.5,"reason":"bad"}',
    );

    await expect(classifyIntent(settings, context)).resolves.toMatchObject({
      verdict: "chat_only",
      reason: "parse_error",
      source: "fallback",
    });
  });

  test("LLM 抛错返回 llm_error fallback", async () => {
    runAITextMock.mockRejectedValue(new Error("boom"));

    await expect(classifyIntent(settings, context)).resolves.toEqual({
      verdict: "chat_only",
      confidence: 0,
      reason: "llm_error",
      source: "fallback",
    });
  });

  test("超时返回 timeout fallback", async () => {
    runAITextMock.mockImplementation(
      (_settings, _messages, options) =>
        new Promise((_, reject) => {
          options.abortSignal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          }, { once: true });
        }),
    );

    const promise = classifyIntent(settings, context, { timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toEqual({
      verdict: "chat_only",
      confidence: 0,
      reason: "timeout",
      source: "fallback",
    });
  });

  test("外部 abort 返回 aborted fallback", async () => {
    runAITextMock.mockImplementation(
      (_settings, _messages, options) =>
        new Promise((_, reject) => {
          options.abortSignal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          }, { once: true });
        }),
    );

    const controller = new AbortController();
    const promise = classifyIntent(settings, context, { abortSignal: controller.signal });
    controller.abort();

    await expect(promise).resolves.toEqual({
      verdict: "chat_only",
      confidence: 0,
      reason: "aborted",
      source: "fallback",
    });
  });
});
