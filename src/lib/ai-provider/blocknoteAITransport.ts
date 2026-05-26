// BlockNote xl-ai 的 ChatTransport 适配器：把项目现有 AI Settings 桥到 Vercel AI SDK。
// v1 支持自定义 OpenAI 兼容协议与 Claude；uTools 内置模型暂未接入（需写自定义 LanguageModelV2）。

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  convertToModelMessages,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import type { AISettingsLike } from "./types";
import { getAIAvailability } from "./modelCatalog";

function buildModel(settings: AISettingsLike, modelId: string) {
  const avail = getAIAvailability(settings);
  if (!avail.ok) throw new Error(avail.reason);
  if (avail.provider === "utools") {
    throw new Error(
      "uTools 内置模型暂不支持编辑器内 BlockNote AI 菜单。请在 设置 → AI 助手 中切换到自定义 OpenAI 或 Claude provider。",
    );
  }

  const normalizeBase = (url: string, fallback: string) =>
    (url || fallback).replace(/\/+$/, "");

  if (settings.customProtocol === "openai") {
    const provider = createOpenAICompatible({
      name: "goose-openai",
      baseURL: normalizeBase(settings.customOpenAIBaseURL, "https://api.openai.com/v1"),
      apiKey: settings.customOpenAIApiKey,
    });
    return provider.chatModel(modelId);
  }

  // Claude
  const provider = createAnthropic({
    baseURL: normalizeBase(settings.customClaudeBaseURL, "https://api.anthropic.com/v1"),
    apiKey: settings.customClaudeApiKey,
    headers: {
      // 浏览器侧 Anthropic CORS 需要这个 header
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });
  return provider(modelId);
}

export interface CreateGooseAITransportOptions {
  getSettings: () => AISettingsLike;
  getModelId: () => string;
}

// 工厂函数：避开 TypeScript erasableSyntaxOnly 对 class parameter property 的限制
export function createGooseAITransport(
  options: CreateGooseAITransportOptions,
): ChatTransport<UIMessage> {
  const sendMessages: ChatTransport<UIMessage>["sendMessages"] = async (params) => {
    const settings = options.getSettings();
    const modelId = options.getModelId();
    const model = buildModel(settings, modelId);
    // convertToModelMessages 在 AI SDK v6 是异步的
    const modelMessages = await convertToModelMessages(params.messages);

    const result = streamText({
      model,
      messages: modelMessages,
      abortSignal: params.abortSignal,
    });
    return result.toUIMessageStream() as unknown as ReadableStream<UIMessageChunk>;
  };

  const reconnectToStream: ChatTransport<UIMessage>["reconnectToStream"] = async () => null;

  return {
    sendMessages,
    reconnectToStream,
  };
}
