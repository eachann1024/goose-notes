import {
  getAvailableUToolsAiModels,
  isUToolsAiSupported,
  type UToolsAiModel,
} from "@/lib/utools-ai";
import type {
  AIModelOption,
  AIProviderMode,
  AISettingsLike,
  AIReasoningLevel,
  AIRequestOverrides,
  CustomAIProtocol,
  UToolsAiApi,
} from "./types";

export const DEFAULT_UTOOLS_MODEL = "deepseek-v3";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com/v1";
export const SETTINGS_ENTRY_HINT = '请前往"设置 -> AI 助手 -> 自定义 AI"检查配置。';
export const ANTHROPIC_THINKING_BUDGET: Record<AIReasoningLevel, number> = {
  default: 0,
  low: 1024,
  medium: 4096,
  high: 12000,
};

export function getUToolsApi(): UToolsAiApi | null {
  if (typeof window === "undefined") return null;
  return ((window as Window & { utools?: UToolsAiApi }).utools ?? null);
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
    typeof maybeModel.display_name === "string" && maybeModel.display_name.trim()
      ? maybeModel.display_name
      : typeof maybeModel.name === "string" && maybeModel.name.trim()
        ? maybeModel.name
        : id;

  const descriptionParts = [
    typeof maybeModel.description === "string" ? maybeModel.description.trim() : "",
    typeof maybeModel.type === "string" ? maybeModel.type.trim() : "",
  ].filter(Boolean);

  return {
    id,
    label: labelSource.trim(),
    description: descriptionParts.length ? descriptionParts.join(" · ") : undefined,
  };
}

function getOpenAIModelsUrl(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}

function getClaudeModelsUrl(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}

export function getDefaultCustomAIBaseURL(protocol: CustomAIProtocol) {
  return protocol === "openai" ? DEFAULT_OPENAI_BASE_URL : DEFAULT_CLAUDE_BASE_URL;
}

function normalizeCustomAIBaseURL(baseURL: string, protocol: CustomAIProtocol) {
  return baseURL.trim() || getDefaultCustomAIBaseURL(protocol);
}

export function getCustomAIBaseURL(
  settings: AISettingsLike,
  protocol: CustomAIProtocol = settings.customProtocol,
) {
  return normalizeCustomAIBaseURL(
    protocol === "openai" ? settings.customOpenAIBaseURL : settings.customClaudeBaseURL,
    protocol,
  );
}

export function getCustomAIApiKey(
  settings: AISettingsLike,
  protocol: CustomAIProtocol = settings.customProtocol,
) {
  return (protocol === "openai" ? settings.customOpenAIApiKey : settings.customClaudeApiKey).trim();
}

export async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    if (typeof payload?.error?.message === "string" && payload.error.message.trim()) {
      return payload.error.message.trim();
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // ignore non-json responses
  }

  try {
    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
}

export function getApiKeyMissingMessage() {
  return `未填写 API Key。${SETTINGS_ENTRY_HINT}`;
}

export function getAuthFailedMessage(providerLabel: string) {
  return `${providerLabel} 鉴权失败。${SETTINGS_ENTRY_HINT}`;
}

export function getAIProviderMode(settings: AISettingsLike): AIProviderMode {
  return settings.useCustomProvider ? "custom" : "utools";
}

export function getStoredAIModelOptions(settings: Pick<AISettingsLike, "useCustomProvider" | "customModelOptions">) {
  return settings.useCustomProvider ? settings.customModelOptions : [];
}

export function mapUToolsAiModelsToOptions(models: UToolsAiModel[]): AIModelOption[] {
  return models
    .filter((item) => Boolean(item?.id && item?.label))
    .map((item) => ({
      id: item.id.trim(),
      label: item.label.trim(),
      description: item.description?.trim() || undefined,
    }))
    .filter((item) => item.id && item.label);
}

export async function getAvailableAIModelOptions(settings: Pick<AISettingsLike, "useCustomProvider" | "customModelOptions">) {
  if (settings.useCustomProvider) {
    return getStoredAIModelOptions(settings);
  }

  const models = await getAvailableUToolsAiModels();
  return mapUToolsAiModelsToOptions(models);
}

export function getRequestedModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  const overrideModelId = requestOverrides?.selectedModelId?.trim();
  if (overrideModelId) {
    return overrideModelId;
  }

  return settings.selectedModelId?.trim() || null;
}

export function getCustomSelectedModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  return getRequestedModelId(settings, requestOverrides) ?? settings.customModelOptions[0]?.id ?? null;
}

export function getRequestReasoningLevel(
  settings: Pick<AISettingsLike, "workspaceReasoningLevel">,
  requestOverrides?: AIRequestOverrides,
) {
  const reasoningLevel =
    requestOverrides?.reasoningLevel ?? settings.workspaceReasoningLevel;
  if (!reasoningLevel || reasoningLevel === "default") {
    return null;
  }

  return reasoningLevel;
}

export function getCustomProviderOptions(
  settings: AISettingsLike,
  requestOverrides?: AIRequestOverrides,
): Record<string, Record<string, unknown>> | undefined {
  const reasoningLevel = getRequestReasoningLevel(settings, requestOverrides);
  if (!reasoningLevel) {
    return undefined;
  }

  if (settings.customProtocol === "openai") {
    return {
      openaiCompatible: {
        reasoningEffort: reasoningLevel,
      },
    };
  }

  return {
    anthropic: {
      thinking: {
        type: "enabled" as const,
        budgetTokens: ANTHROPIC_THINKING_BUDGET[reasoningLevel],
      },
    },
  };
}

export function getAIAvailability(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  if (!settings.enabled) {
    return { ok: false as const, reason: "AI 助手尚未开启，请先到设置中打开" };
  }

  if (!settings.useCustomProvider) {
    const utools = getUToolsApi();
    if (!utools) {
      return { ok: false as const, reason: "当前不在 uTools 环境内" };
    }

    if (!isUToolsAiSupported() || typeof utools.ai !== "function") {
      return { ok: false as const, reason: "当前 uTools 版本未提供 AI 能力" };
    }

    return { ok: true as const, provider: "utools" as const };
  }

  if (!getCustomAIApiKey(settings)) {
    return { ok: false as const, reason: getApiKeyMissingMessage() };
  }

  const selectedModelId = getCustomSelectedModelId(settings, requestOverrides);
  if (!selectedModelId) {
    return { ok: false as const, reason: "请先保存自定义 AI 配置并获取模型列表" };
  }

  return { ok: true as const, provider: "custom" as const };
}

export async function fetchCustomAIModels(config: {
  protocol: CustomAIProtocol;
  baseURL: string;
  apiKey: string;
}) {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error(getApiKeyMissingMessage());
  }

  const modelsUrl = config.protocol === "openai" ? getOpenAIModelsUrl(config.baseURL) : getClaudeModelsUrl(config.baseURL);

  const response = await fetch(modelsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(errorMsg || getAuthFailedMessage(config.protocol === "openai" ? "自定义 OpenAI兼容源" : "自定义 Claude源"));
  }

  const payload = await response.json();
  const rawList = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);

  if (rawList.length === 0 && config.protocol === "claude") {
    return [
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus" }
    ];
  }

  const parsed = (rawList as unknown[])
    .map(normalizeModelOption)
    .filter((item): item is AIModelOption => item !== null && Boolean(item.id && item.label));

  return parsed;
}

export async function resolveUToolsModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  try {
    const models = await getAvailableUToolsAiModels();
    const validModels = models.filter((item) => item.id?.trim());
    if (!validModels.length) {
      return DEFAULT_UTOOLS_MODEL;
    }

    const requestedModelId = getRequestedModelId(settings, requestOverrides);
    if (requestedModelId) {
      const normalizedRequested = requestedModelId.trim().toLowerCase();
      const matchedRequestedModel = validModels.find((item) => {
        const normalizedId = item.id.trim().toLowerCase();
        const normalizedLabel = item.label.trim().toLowerCase();
        return (
          normalizedId === normalizedRequested ||
          normalizedLabel === normalizedRequested
        );
      });
      if (matchedRequestedModel) {
        return matchedRequestedModel.id;
      }
    }

    const defaultModel = validModels.find((item) => item.id === DEFAULT_UTOOLS_MODEL);
    return defaultModel?.id ?? validModels[0].id;
  } catch {
    return getRequestedModelId(settings, requestOverrides) ?? DEFAULT_UTOOLS_MODEL;
  }
}
