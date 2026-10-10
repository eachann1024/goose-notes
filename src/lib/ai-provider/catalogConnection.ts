import type {
  AIModelOption,
  AISettingsLike,
  AIReasoningLevel,
  AIRequestOverrides,
  CustomAIProtocol,
} from "./types";
import {
  getProviderFixedBaseURL,
  inferProviderIdFromSettings,
  isAIProviderId,
  resolveProtocolForProvider,
  type AIProviderId,
} from "./presets";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com/v1";
export const SETTINGS_ENTRY_HINT =
  "请前往「设置 › AI 助手 › AI 服务」检查配置。";
export const ANTHROPIC_THINKING_BUDGET: Record<AIReasoningLevel, number> = {
  default: 0,
  low: 1024,
  medium: 4096,
  high: 12000,
};

export function getSettingsProviderId(
  settings: Pick<
    AISettingsLike,
    | "customProviderId"
    | "customProtocol"
    | "customOpenAIResponsesBaseURL"
    | "customOpenAIBaseURL"
    | "customClaudeBaseURL"
  >,
): AIProviderId {
  if (isAIProviderId(settings.customProviderId)) {
    return settings.customProviderId;
  }
  return inferProviderIdFromSettings(settings);
}

/**
 * 按供应商 + 当前模型解析实际协议。
 * DeepSeek：Flash → Responses；Pro → 兼容 Chat Completions。
 */
export function resolveActiveProtocol(
  settings: AISettingsLike,
  requestOverrides?: AIRequestOverrides,
): CustomAIProtocol {
  const providerId = getSettingsProviderId(settings);
  const modelId =
    requestOverrides?.selectedModelId?.trim() ||
    settings.selectedModelId?.trim() ||
    null;
  return resolveProtocolForProvider(
    providerId,
    modelId,
    settings.customProtocol,
  );
}

export function normalizeModelOption(input: unknown): AIModelOption | null {
  if (!input) return null;

  if (typeof input === "string") {
    const id = input.trim();
    return id ? { id, label: id } : null;
  }

  if (typeof input !== "object") return null;

  const maybeModel = input as {
    id?: unknown;
    name?: unknown;
    display_name?: unknown;
    description?: unknown;
    type?: unknown;
  };

  const id = typeof maybeModel.id === "string" ? maybeModel.id.trim() : "";
  if (!id) return null;

  const labelSource =
    typeof maybeModel.display_name === "string" &&
    maybeModel.display_name.trim()
      ? maybeModel.display_name
      : typeof maybeModel.name === "string" && maybeModel.name.trim()
        ? maybeModel.name
        : id;

  const descriptionParts = [
    typeof maybeModel.description === "string"
      ? maybeModel.description.trim()
      : "",
    typeof maybeModel.type === "string" ? maybeModel.type.trim() : "",
  ].filter(Boolean);

  return {
    id,
    label: labelSource.trim(),
    description: descriptionParts.length
      ? descriptionParts.join(" · ")
      : undefined,
  };
}

export function getOpenAIModelsUrl(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}

export function getClaudeModelsUrl(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}

export function getDefaultCustomAIBaseURL(protocol: CustomAIProtocol) {
  return protocol === "claude"
    ? DEFAULT_CLAUDE_BASE_URL
    : DEFAULT_OPENAI_BASE_URL;
}

export function getCustomAIBaseURL(
  settings: AISettingsLike,
  protocol: CustomAIProtocol = resolveActiveProtocol(settings),
) {
  const providerId = getSettingsProviderId(settings);
  const fixedBaseURL = getProviderFixedBaseURL(providerId);
  if (fixedBaseURL) {
    return fixedBaseURL;
  }

  if (protocol === "claude") {
    const baseURL = settings.customClaudeBaseURL?.trim();
    return baseURL || DEFAULT_CLAUDE_BASE_URL;
  }
  if (protocol === "openai") {
    const baseURL = settings.customOpenAIBaseURL?.trim();
    return baseURL || DEFAULT_OPENAI_BASE_URL;
  }
  const baseURL = settings.customOpenAIResponsesBaseURL?.trim();
  return baseURL || DEFAULT_OPENAI_BASE_URL;
}

export function getCustomAIApiKey(
  settings: AISettingsLike,
  protocol: CustomAIProtocol = resolveActiveProtocol(settings),
) {
  const key = (
    protocol === "openai-responses"
      ? settings.customOpenAIResponsesApiKey
      : protocol === "openai"
        ? settings.customOpenAIApiKey
        : settings.customClaudeApiKey
  ).trim();

  // DeepSeek 双协议共用同一 Key：某一槽位为空时回退另一槽位。
  if (!key && getSettingsProviderId(settings) === "deepseek") {
    return (
      settings.customOpenAIResponsesApiKey?.trim() ||
      settings.customOpenAIApiKey?.trim() ||
      ""
    );
  }

  return key;
}
