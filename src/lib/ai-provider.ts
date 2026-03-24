import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import { getAvailableUToolsAiModels, isUToolsAiSupported } from "@/lib/utools-ai";

export type CustomAIProtocol = "openai" | "claude";

export interface AIModelOption {
  id: string;
  label: string;
  description?: string;
}

export type AIProviderMode = "utools" | "custom";

export interface AISettingsLike {
  enabled: boolean;
  selectedModelId: string | null;
  useCustomProvider: boolean;
  customProtocol: CustomAIProtocol;
  customBaseURL: string;
  customApiKey: string;
  customModelOptions: AIModelOption[];
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content?: string;
}

export type AIStreamPhase = "connecting" | "thinking" | "generating" | "finishing";

export interface AIStreamUpdate {
  phase: AIStreamPhase;
  text: string;
  reasoningText: string;
}

interface RunAITextStreamOptions {
  abortSignal?: AbortSignal;
  onUpdate?: (update: AIStreamUpdate) => void;
}

interface UToolsAiApi {
  ai?: (option: {
    model?: string;
    messages: AIMessage[];
  }) => Promise<{ content?: string }>;
}

const DEFAULT_UTOOLS_MODEL = "deepseek-v3";
const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const SETTINGS_ENTRY_HINT = "请前往“设置 -> AI 助手 -> 自定义 AI”检查配置。";

function getUToolsApi(): UToolsAiApi | null {
  if (typeof window === "undefined") return null;
  return ((window as Window & { utools?: UToolsAiApi }).utools ?? null);
}

function normalizeModelOption(input: unknown): AIModelOption | null {
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

async function readErrorMessage(response: Response) {
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

function getApiKeyMissingMessage() {
  return `未填写 API Key。${SETTINGS_ENTRY_HINT}`;
}

function getAuthFailedMessage(providerLabel: string) {
  return `${providerLabel} 鉴权失败。${SETTINGS_ENTRY_HINT}`;
}

export function getAIProviderMode(settings: AISettingsLike): AIProviderMode {
  return settings.useCustomProvider ? "custom" : "utools";
}

export function getStoredAIModelOptions(settings: AISettingsLike) {
  return settings.useCustomProvider ? settings.customModelOptions : [];
}

export function getAIAvailability(settings: AISettingsLike) {
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

  if (!settings.customApiKey.trim()) {
    return { ok: false as const, reason: getApiKeyMissingMessage() };
  }

  if (settings.customProtocol === "openai" && !settings.customBaseURL.trim()) {
    return { ok: false as const, reason: "请先填写 OpenAI 兼容接口地址后再保存" };
  }

  const selectedModelId = settings.selectedModelId ?? settings.customModelOptions[0]?.id ?? null;
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

  const response =
    config.protocol === "openai"
      ? await fetch(getOpenAIModelsUrl(config.baseURL.trim()), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      : await fetch(ANTHROPIC_MODELS_URL, {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    if (response.status === 401 || response.status === 403) {
      throw new Error(getAuthFailedMessage(config.protocol === "openai" ? "OpenAI 兼容接口" : "Claude 接口"));
    }
    throw new Error(detail || `读取模型列表失败（${response.status}）`);
  }

  const payload = await response.json();
  const rawModels = Array.isArray(payload?.data) ? payload.data : [];
  const models = rawModels
    .map((item: unknown) => normalizeModelOption(item))
    .filter((item: AIModelOption | null): item is AIModelOption => Boolean(item));

  if (models.length === 0) {
    throw new Error("未读取到可用模型");
  }

  return models;
}

async function resolveUToolsModelId(settings: AISettingsLike) {
  try {
    const models = await getAvailableUToolsAiModels();
    if (!models.length) {
      return DEFAULT_UTOOLS_MODEL;
    }

    if (settings.selectedModelId && models.some((item) => item.id === settings.selectedModelId)) {
      return settings.selectedModelId;
    }

    const defaultModel = models.find((item) => item.id === DEFAULT_UTOOLS_MODEL);
    return defaultModel?.id ?? models[0].id;
  } catch {
    return settings.selectedModelId ?? DEFAULT_UTOOLS_MODEL;
  }
}

async function runUToolsText(settings: AISettingsLike, messages: AIMessage[]) {
  const utools = getUToolsApi();
  if (!utools?.ai) {
    throw new Error("当前 uTools 版本未提供 AI 能力");
  }

  const modelId = await resolveUToolsModelId(settings);
  const result = await utools.ai({
    model: modelId,
    messages,
  });

  const content = result?.content?.trim();
  if (!content) {
    throw new Error("AI 没有返回可用内容");
  }

  return content;
}

async function runCustomText(settings: AISettingsLike, messages: AIMessage[]) {
  const selectedModelId = settings.selectedModelId ?? settings.customModelOptions[0]?.id ?? null;
  if (!selectedModelId) {
    throw new Error("请先保存自定义 AI 配置并获取模型列表");
  }

  const model =
    settings.customProtocol === "openai"
      ? createOpenAICompatible({
          baseURL: settings.customBaseURL.trim(),
          apiKey: settings.customApiKey.trim(),
          name: "custom.openai",
        }).chatModel(selectedModelId)
      : createAnthropic({
          apiKey: settings.customApiKey.trim(),
          name: "custom.claude",
        })(selectedModelId);

  const { text } = await generateText({
    model,
    messages: messages
      .filter((message) => typeof message.content === "string" && message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content!.trim(),
      })),
  });

  const content = text.trim();
  if (!content) {
    throw new Error("AI 没有返回可用内容");
  }

  return content;
}

function normalizeMessages(messages: AIMessage[]) {
  return messages
    .filter((message) => typeof message.content === "string" && message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content!.trim(),
    }));
}

async function runUToolsTextStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  options: RunAITextStreamOptions = {},
) {
  options.onUpdate?.({
    phase: "generating",
    text: "",
    reasoningText: "",
  });

  const content = await runUToolsText(settings, messages);

  options.onUpdate?.({
    phase: "finishing",
    text: content,
    reasoningText: "",
  });

  return content;
}

async function runCustomTextStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  options: RunAITextStreamOptions = {},
) {
  const selectedModelId = settings.selectedModelId ?? settings.customModelOptions[0]?.id ?? null;
  if (!selectedModelId) {
    throw new Error("请先保存自定义 AI 配置并获取模型列表");
  }

  const model =
    settings.customProtocol === "openai"
      ? createOpenAICompatible({
          baseURL: settings.customBaseURL.trim(),
          apiKey: settings.customApiKey.trim(),
          name: "custom.openai",
        }).chatModel(selectedModelId)
      : createAnthropic({
          apiKey: settings.customApiKey.trim(),
          name: "custom.claude",
        })(selectedModelId);

  let text = "";
  let reasoningText = "";
  let phase: AIStreamPhase = "connecting";

  const emit = (nextPhase: AIStreamPhase) => {
    phase = nextPhase;
    options.onUpdate?.({
      phase,
      text,
      reasoningText,
    });
  };

  emit("connecting");

  const result = streamText({
    model,
    abortSignal: options.abortSignal,
    messages: normalizeMessages(messages),
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "start":
      case "start-step":
      case "reasoning-start": {
        emit("thinking");
        break;
      }
      case "reasoning-delta": {
        reasoningText += part.text;
        emit("thinking");
        break;
      }
      case "text-start": {
        emit("generating");
        break;
      }
      case "text-delta": {
        text += part.text;
        emit("generating");
        break;
      }
      case "finish-step":
      case "text-end":
      case "reasoning-end":
      case "finish": {
        emit(text.trim() ? "finishing" : "thinking");
        break;
      }
      case "error": {
        throw part.error instanceof Error ? part.error : new Error("AI 流式生成失败");
      }
    }
  }

  const content = text.trim();
  if (!content) {
    throw new Error("AI 没有返回可用内容");
  }

  return content;
}

export async function runAIText(settings: AISettingsLike, messages: AIMessage[]) {
  const availability = getAIAvailability(settings);
  if (!availability.ok) {
    throw new Error(availability.reason);
  }

  return availability.provider === "custom"
    ? runCustomText(settings, messages)
    : runUToolsText(settings, messages);
}

export async function runAITextStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  options: RunAITextStreamOptions = {},
) {
  const availability = getAIAvailability(settings);
  if (!availability.ok) {
    throw new Error(availability.reason);
  }

  return availability.provider === "custom"
    ? runCustomTextStream(settings, messages, options)
    : runUToolsTextStream(settings, messages, options);
}
