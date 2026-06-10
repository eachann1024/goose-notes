import type { LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { useSettings } from "@/stores/useSettings";

export type ModelAvailability =
  | { ok: true; model: LanguageModel }
  | { ok: false; reason: string };

/**
 * 从 settings 的自定义 AI 配置构造 LanguageModel。
 * 支持 openai-compatible 和 anthropic 两种协议。
 * 未配置自定义 provider 时返回 ok=false。
 */
export function buildLanguageModel(): ModelAvailability {
  const ai = useSettings.getState().ai;

  if (!ai.enabled) {
    return { ok: false, reason: "AI 功能未开启，请前往设置启用 AI 助手。" };
  }

  if (!ai.useCustomProvider) {
    return {
      ok: false,
      reason:
        "请在设置中配置自定义模型（支持 OpenAI 兼容 API 或 Anthropic API）才能使用 AI 笔记本功能。",
    };
  }

  const modelId =
    (ai.workspaceSelectedModelId ?? ai.selectedModelId ?? "").trim();
  if (!modelId) {
    return {
      ok: false,
      reason: "请在设置中选择一个模型后再使用 AI 笔记本功能。",
    };
  }

  try {
    if (ai.customProtocol === "claude") {
      const baseURL = (ai.customClaudeBaseURL || "https://api.anthropic.com").replace(
        /\/+$/,
        "",
      );
      const provider = createAnthropic({
        apiKey: ai.customClaudeApiKey || "placeholder",
        baseURL,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      return { ok: true, model: provider(modelId) };
    }

    // 默认 openai-compatible
    const baseURL = (
      ai.customOpenAIBaseURL || "https://api.openai.com/v1"
    ).replace(/\/+$/, "");
    const provider = createOpenAICompatible({
      name: "custom-openai",
      baseURL,
      apiKey: ai.customOpenAIApiKey || "placeholder",
    });
    return { ok: true, model: provider.chatModel(modelId) };
  } catch (err) {
    return {
      ok: false,
      reason: `构造模型失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
