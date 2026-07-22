import { expect, test } from "playwright/test";
import { handleOpenAIResponsesStream } from "../../src/lib/ai-provider/providers/openaiResponses";
import type { AISettingsLike } from "../../src/lib/ai-provider/types";
import { normalizeAISettings } from "../../src/stores/settings/types";

const settings: AISettingsLike = {
  enabled: true,
  selectedModelId: "gpt-test",
  workspaceReasoningLevel: "high",
  customProtocol: "openai-responses",
  customOpenAIResponsesBaseURL: "https://responses.example.test/v1/",
  customOpenAIBaseURL: "https://compatible.example.test/v1",
  customClaudeBaseURL: "https://api.anthropic.com/v1",
  customOpenAIResponsesApiKey: "responses-key",
  customOpenAIApiKey: "compatible-key",
  customClaudeApiKey: "anthropic-key",
  customModelOptions: [{ id: "gpt-test", label: "GPT Test" }],
};

test("Responses 协议发送独立配置并解析文本与推理摘要事件", async () => {
  const originalFetch = globalThis.fetch;
  let requestURL = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestURL = String(input);
    requestInit = init;
    const events = [
      'data: {"type":"response.reasoning_summary_text.delta","delta":"分析"}',
      'data: {"type":"response.output_text.delta","delta":"答案"}',
      'data: {"type":"response.completed"}',
      "",
    ].join("\n");
    return new Response(events, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  try {
    const updates: Array<{ text: string; isReasoning: boolean }> = [];
    const result = await handleOpenAIResponsesStream(
      settings,
      [
        { role: "system", content: "系统要求" },
        { role: "user", content: "用户问题" },
      ],
      new AbortController().signal,
      (_phase, text, isReasoning) => updates.push({ text, isReasoning }),
    );

    expect(requestURL).toBe("https://responses.example.test/v1/responses");
    expect((requestInit?.headers as Record<string, string>).Authorization).toBe(
      "Bearer responses-key",
    );
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      model: "gpt-test",
      input: [{ role: "user", content: "用户问题" }],
      stream: true,
      store: false,
      instructions: "系统要求",
      reasoning: { effort: "high", summary: "auto" },
    });
    expect(updates).toEqual([
      { text: "分析", isReasoning: true },
      { text: "答案", isReasoning: false },
    ]);
    expect(result).toEqual({ text: "答案", reasoningText: "分析" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("旧 OpenAI 兼容配置保持原协议并迁移一份 Responses 独立配置", () => {
  const normalized = normalizeAISettings({
    useCustomProvider: false,
    customProtocol: "openai",
    customOpenAIBaseURL: "https://legacy.example.test/v1",
    customOpenAIApiKey: "legacy-key",
  } as never);

  expect(normalized.customProtocol).toBe("openai");
  expect(normalized.customOpenAIBaseURL).toBe("https://legacy.example.test/v1");
  expect(normalized.customOpenAIApiKey).toBe("legacy-key");
  expect(normalized.customOpenAIResponsesBaseURL).toBe(
    "https://legacy.example.test/v1",
  );
  expect(normalized.customOpenAIResponsesApiKey).toBe("legacy-key");
  expect("useCustomProvider" in normalized).toBe(false);
});
