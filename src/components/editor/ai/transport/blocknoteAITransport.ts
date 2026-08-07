// BlockNote xl-ai 的 ChatTransport 适配器：把项目现有 AI Settings 桥到 Vercel AI SDK。
// 同时支持 OpenAI Responses、OpenAI-compatible Chat Completions 与 Anthropic。

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { aiDocumentFormats, ClientSideTransport } from "@blocknote/xl-ai";
import type { ChatTransport, UIMessage } from "ai";
import type { AISettingsLike } from "@/lib/ai-provider/types";
import {
  getCustomAIApiKey,
  getCustomAIBaseURL,
  resolveActiveProtocol,
  getApiKeyMissingMessage,
} from "@/lib/ai-provider";

/** openai-compatible 路径的 provider name，需与 createOpenAICompatible({ name }) 一致。 */
const OPENAI_COMPAT_PROVIDER_NAME = "goose-openai";

/**
 * 行内 AI 依赖 tool call（xl-ai 默认 toolChoice:"required"）。
 * DeepSeek Thinking 等模型在 thinking 开启时会拒绝 tool_choice=required。
 * 在 fetch 层注入关闭 thinking/reasoning，比 providerOptions 更可靠（不依赖 SDK 透传）。
 */
function wrapFetchToDisableThinking(
  baseFetch: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    try {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "POST" || init?.body == null) {
        return baseFetch(input, init);
      }

      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      const rawBody =
        typeof init.body === "string"
          ? init.body
          : // Request body 已是字符串时 AI SDK 通常传 string；其余原样转发
            null;
      if (rawBody == null) {
        return baseFetch(input, init);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return baseFetch(input, init);
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return baseFetch(input, init);
      }

      const body = parsed as Record<string, unknown>;
      const isResponses = url.includes("/responses");
      const isChatCompletions =
        url.includes("chat/completions") ||
        (Array.isArray(body.messages) && body.tools != null);

      let changed = false;

      if (isChatCompletions) {
        // DeepSeek / 兼容接口：关闭 thinking，才能稳定接受 tool_choice=required
        if (body.thinking == null) {
          body.thinking = { type: "disabled" };
          changed = true;
        }
      } else if (isResponses) {
        // OpenAI Responses：关闭 reasoning
        const existing =
          body.reasoning &&
          typeof body.reasoning === "object" &&
          !Array.isArray(body.reasoning)
            ? (body.reasoning as Record<string, unknown>)
            : {};
        if (existing.effort !== "none") {
          body.reasoning = { ...existing, effort: "none" };
          changed = true;
        }
      }

      if (!changed) {
        return baseFetch(input, init);
      }

      return baseFetch(input, {
        ...init,
        body: JSON.stringify(body),
      });
    } catch {
      // 包装逻辑异常时绝不阻断请求
      return baseFetch(input, init);
    }
  };
}

function buildModel(
  settings: AISettingsLike,
  modelId: string,
  fetchImpl: typeof fetch,
) {
  if (!settings.enabled) {
    throw new Error("AI 助手尚未开启，请先到设置中打开");
  }

  const resolvedModelId = modelId.trim();
  if (!resolvedModelId) {
    throw new Error("请先选择模型后再使用行内 AI");
  }

  const protocol = resolveActiveProtocol(settings, {
    selectedModelId: resolvedModelId,
  });
  const apiKey = getCustomAIApiKey(settings, protocol);
  if (!apiKey) {
    throw new Error(getApiKeyMissingMessage());
  }
  const baseURL = getCustomAIBaseURL(settings, protocol).replace(/\/+$/, "");

  if (protocol === "openai-responses") {
    const provider = createOpenAI({
      baseURL,
      apiKey,
      fetch: fetchImpl,
    });
    return { model: provider.responses(resolvedModelId), protocol };
  }

  if (protocol === "openai") {
    const provider = createOpenAICompatible({
      name: OPENAI_COMPAT_PROVIDER_NAME,
      baseURL,
      apiKey,
      fetch: fetchImpl,
    });
    return { model: provider.chatModel(resolvedModelId), protocol };
  }

  // Anthropic
  const provider = createAnthropic({
    baseURL,
    apiKey,
    headers: {
      // 浏览器侧 Anthropic CORS 需要这个 header
      "anthropic-dangerous-direct-browser-access": "true",
    },
    fetch: fetchImpl,
  });
  return { model: provider(resolvedModelId), protocol };
}

export interface CreateGooseAITransportOptions {
  getSettings: () => AISettingsLike;
  getModelId: () => string;
  /**
   * 宿主注入的 fetch（如 Tauri plugin-http，绕过 WebView CORS）。
   * 未提供时回退 globalThis.fetch。
   */
  getCustomFetch?: () => typeof fetch | undefined;
}

// 工厂函数：xl-ai 需要 LLM 返回结构化 tool calls（不是纯文本），因此必须用
// xl-ai 提供的 ClientSideTransport — 它会带上 tools + toolChoice:"required"。
// 通过 fetch 包装关闭 thinking/reasoning，避免 thinking 模型拒绝 required。
export function createGooseAITransport(
  options: CreateGooseAITransportOptions,
): ChatTransport<UIMessage> {
  const sendMessages: ChatTransport<UIMessage>["sendMessages"] = async (
    params,
  ) => {
    const settings = options.getSettings();
    const modelId = options.getModelId();
    const baseFetch = options.getCustomFetch?.() ?? globalThis.fetch;
    const fetchImpl = wrapFetchToDisableThinking(baseFetch);
    const { model } = buildModel(settings, modelId, fetchImpl);
    const inner = new ClientSideTransport({
      model,
      systemPrompt: aiDocumentFormats.html.systemPrompt,
      // 不覆盖 toolChoice：保留 xl-ai 默认 "required"，保证写文档 tool 必出。
      // thinking 已在 fetch 层关闭；若个别模型仍 400，再考虑 auto 兜底。
    });
    return inner.sendMessages(params);
  };

  const reconnectToStream: ChatTransport<UIMessage>["reconnectToStream"] =
    async () => null;

  return {
    sendMessages,
    reconnectToStream,
  };
}
