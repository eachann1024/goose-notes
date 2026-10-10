import type {
  AIModelOption,
  AISettingsLike,
  AIRequestOverrides,
  CustomAIProtocol,
} from "./types";
import {
  getAIProviderPreset,
  isAIProviderId,
  type AIProviderId,
} from "./presets";
import {
  SETTINGS_ENTRY_HINT,
  ANTHROPIC_THINKING_BUDGET,
  resolveActiveProtocol,
  getCustomAIApiKey,
  normalizeModelOption,
  getClaudeModelsUrl,
  getOpenAIModelsUrl,
} from "./catalogConnection";
export {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_CLAUDE_BASE_URL,
  SETTINGS_ENTRY_HINT,
  ANTHROPIC_THINKING_BUDGET,
  getSettingsProviderId,
  resolveActiveProtocol,
  normalizeModelOption,
  getDefaultCustomAIBaseURL,
  getCustomAIBaseURL,
  getCustomAIApiKey,
} from "./catalogConnection";

export async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    if (
      typeof payload?.error?.message === "string" &&
      payload.error.message.trim()
    ) {
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

export function getStoredAIModelOptions(
  settings: Pick<AISettingsLike, "customModelOptions">,
) {
  return settings.customModelOptions;
}

export function getRequestedModelId(
  settings: AISettingsLike,
  requestOverrides?: AIRequestOverrides,
) {
  const overrideModelId = requestOverrides?.selectedModelId?.trim();
  if (overrideModelId) {
    return overrideModelId;
  }

  return settings.selectedModelId?.trim() || null;
}

export function getCustomSelectedModelId(
  settings: AISettingsLike,
  requestOverrides?: AIRequestOverrides,
) {
  return (
    getRequestedModelId(settings, requestOverrides) ??
    settings.customModelOptions[0]?.id ??
    null
  );
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

  const protocol = resolveActiveProtocol(settings, requestOverrides);

  if (protocol === "openai") {
    return {
      openaiCompatible: {
        reasoningEffort: reasoningLevel,
      },
    };
  }

  if (protocol === "openai-responses") {
    return {
      openai: {
        reasoningEffort: reasoningLevel,
        reasoningSummary: "auto",
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

export function getAIAvailability(
  settings: AISettingsLike,
  requestOverrides?: AIRequestOverrides,
) {
  if (!settings.enabled) {
    return { ok: false as const, reason: "AI 助手尚未开启，请先到设置中打开" };
  }

  if (!getCustomAIApiKey(settings)) {
    return { ok: false as const, reason: getApiKeyMissingMessage() };
  }

  const selectedModelId = getCustomSelectedModelId(settings, requestOverrides);
  if (!selectedModelId) {
    return {
      ok: false as const,
      reason: "请先保存自定义 AI 配置并获取模型列表",
    };
  }

  return { ok: true as const };
}

export async function fetchCustomAIModels(config: {
  protocol: CustomAIProtocol;
  baseURL: string;
  apiKey: string;
  providerId?: AIProviderId | string | null;
  signal?: AbortSignal;
}) {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error(getApiKeyMissingMessage());
  }

  const providerId = isAIProviderId(config.providerId)
    ? config.providerId
    : null;
  const preset = providerId ? getAIProviderPreset(providerId) : null;
  const providerLabel =
    preset?.label ??
    (config.protocol === "claude"
      ? "自定义 Anthropic 源"
      : config.protocol === "openai-responses"
        ? "自定义 OpenAI Responses 源"
        : "自定义 OpenAI 兼容源");

  const modelsUrl =
    config.protocol === "claude"
      ? getClaudeModelsUrl(config.baseURL)
      : getOpenAIModelsUrl(config.baseURL);

  const response = await fetch(modelsUrl, {
    headers:
      config.protocol === "claude"
        ? {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          }
        : { Authorization: `Bearer ${apiKey}` },
    ...(config.signal ? { signal: config.signal } : {}),
  });

  if (!response.ok) {
    // 预设供应商鉴权失败时，若有兜底模型且明确是列表接口问题，仍抛错让用户知悉 Key 问题。
    const errorMsg = await readErrorMessage(response);
    throw new Error(errorMsg || getAuthFailedMessage(providerLabel));
  }

  const payload = await response.json();
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  if (rawList.length === 0 && config.protocol === "claude") {
    return [
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    ];
  }

  const parsed = (rawList as unknown[])
    .map(normalizeModelOption)
    .filter(
      (item): item is AIModelOption =>
        item !== null && Boolean(item.id && item.label),
    );

  if (parsed.length === 0 && preset?.fallbackModels?.length) {
    return preset.fallbackModels;
  }

  return parsed;
}
