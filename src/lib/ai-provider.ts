
import {
  getAvailableUToolsAiModels,
  isUToolsAiSupported,
  type UToolsAiModel,
} from "@/lib/utools-ai";

export type CustomAIProtocol = "openai" | "claude";

export interface AIModelOption {
  id: string;
  label: string;
  description?: string;
}

export type AIProviderMode = "utools" | "custom";
export type AIReasoningLevel = "default" | "low" | "medium" | "high";

export interface AISettingsLike {
  enabled: boolean;
  selectedModelId: string | null;
  workspaceReasoningLevel: AIReasoningLevel;
  useCustomProvider: boolean;
  customProtocol: CustomAIProtocol;
  customOpenAIBaseURL: string;
  customClaudeBaseURL: string;
  customOpenAIApiKey: string;
  customClaudeApiKey: string;
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

export interface AIRequestOverrides {
  selectedModelId?: string | null;
  reasoningLevel?: AIReasoningLevel | null;
}

export interface RunAITextOptions {
  abortSignal?: AbortSignal;
  requestOverrides?: AIRequestOverrides;
}

export interface RunAITextStreamOptions extends RunAITextOptions {
  onUpdate?: (update: AIStreamUpdate) => void;
  streamIdleTimeoutMs?: number;
}

interface UToolsAiApi {
  ai?: (
    option: {
      model?: string;
      messages: AIMessage[];
    },
    streamCallback?: (chunk: {
      role?: "system" | "user" | "assistant";
      content?: string;
      reasoning_content?: string;
    }) => void,
  ) => Promise<{
    content?: string;
    reasoning_content?: string;
  }> & { abort?: () => void };
}

const DEFAULT_UTOOLS_MODEL = "deepseek-v3";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com/v1";
const SETTINGS_ENTRY_HINT = "请前往“设置 -> AI 助手 -> 自定义 AI”检查配置。";
const ANTHROPIC_THINKING_BUDGET: Record<AIReasoningLevel, number> = {
  default: 0,
  low: 1024,
  medium: 4096,
  high: 12000,
};

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

function getRequestedModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  const overrideModelId = requestOverrides?.selectedModelId?.trim();
  if (overrideModelId) {
    return overrideModelId;
  }

  return settings.selectedModelId?.trim() || null;
}

function getCustomSelectedModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
  return getRequestedModelId(settings, requestOverrides) ?? settings.customModelOptions[0]?.id ?? null;
}

function getRequestReasoningLevel(
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

function getCustomProviderOptions(
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

async function resolveUToolsModelId(settings: AISettingsLike, requestOverrides?: AIRequestOverrides) {
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

// --- Native SSE Parser Utilities ---
async function* readSSELines(response: Response, signal: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取底层数据流");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      let eolIndex;
      while ((eolIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, eolIndex).trim();
        buffer = buffer.slice(eolIndex + 1);
        if (line) yield line;
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}

async function handleCustomStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  signal: AbortSignal,
  emit: (phase: AIStreamPhase, text: string, isReasoning: boolean) => void,
  requestOverrides?: AIRequestOverrides
) {
  const protocol = settings.customProtocol;
  const apiKey = getCustomAIApiKey(settings, protocol);
  const baseURL = getCustomAIBaseURL(settings, protocol).replace(/\/+$/, "");
  const modelId = getCustomSelectedModelId(settings, requestOverrides);
  const options = getCustomProviderOptions(settings, requestOverrides);

  if (protocol === "openai") {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: messages,
      stream: true,
    };
    if (options?.openaiCompatible) {
      const openaiOpts = options.openaiCompatible as Record<string, unknown>;
      if (openaiOpts.reasoningEffort) {
        body.reasoning_effort = openaiOpts.reasoningEffort;
      }
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    
    if (!response.ok) {
      const errMs = await readErrorMessage(response);
      throw new Error(errMs || "请求自定义 OpenAI 模型失败");
    }
    
    let fullText = "";
    let fullReasoning = "";
    for await (const line of readSSELines(response, signal)) {
      if (line === "data: [DONE]") break;
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        if (!dataStr) continue;
        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          if (delta) {
             if (delta.reasoning_content) {
                fullReasoning += delta.reasoning_content;
                emit("thinking", delta.reasoning_content, true);
             }
             if (delta.content) {
                fullText += delta.content;
                emit("generating", delta.content, false);
             }
          }
        } catch (e) {
          // ignore parse error on single line
        }
      }
    }
    return { text: fullText, reasoningText: fullReasoning };
    
  } else {
    // Claude Stream
    const claudeMessages = messages.filter(m => m.role !== "system");
    const systemInstruction = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    
    const body: Record<string, unknown> = {
      model: modelId,
      messages: claudeMessages,
      max_tokens: 8192,
      stream: true,
    };
    if (systemInstruction) {
      body.system = systemInstruction;
    }
    if (options?.anthropic) {
      const claudeOpts = options.anthropic as any;
      if (claudeOpts.thinking?.budgetTokens) {
        body.thinking = {
           type: "enabled",
           budget_tokens: claudeOpts.thinking.budgetTokens
        };
      }
    }
    
    const response = await fetch(`${baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errMs = await readErrorMessage(response);
      throw new Error(errMs || "请求自定义 Claude 模型失败");
    }

    let fullText = "";
    let fullReasoning = "";
    for await (const line of readSSELines(response, signal)) {
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === "content_block_delta" && json.delta) {
             if (json.delta.type === "thinking_delta") {
                fullReasoning += json.delta.thinking;
                emit("thinking", json.delta.thinking, true);
             } else if (json.delta.type === "text_delta") {
                fullText += json.delta.text;
                emit("generating", json.delta.text, false);
             }
          }
        } catch (e) {
          // parse error
        }
      }
    }
    return { text: fullText, reasoningText: fullReasoning };
  }
}

async function handleUToolsStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  signal: AbortSignal,
  emit: (phase: AIStreamPhase, text: string, isReasoning: boolean) => void,
  requestOverrides?: AIRequestOverrides
) {
  const modelId = await resolveUToolsModelId(settings, requestOverrides);
  const utools = getUToolsApi();
  const utoolsAi = utools?.ai;
  if (!utoolsAi) throw new Error("当前 uTools 环境未提供 AI 方法");

  let fullText = "";
  let fullReasoning = "";
  
  return new Promise<{ text: string, reasoningText: string }>((resolve, reject) => {
    let internalHandler: any = null;
    
    const onAbort = () => {
      internalHandler?.abort?.();
      reject(new DOMException("The operation was aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);

    const callPromise = utoolsAi({
      model: modelId,
      messages: messages as any
    }, (chunk: any) => {
      if (signal.aborted) return;
      if (chunk.reasoning_content) {
        fullReasoning += chunk.reasoning_content;
        emit("thinking", chunk.reasoning_content, true);
      }
      if (chunk.content) {
        fullText += chunk.content;
        emit("generating", chunk.content, false);
      }
    });

    internalHandler = callPromise;
    
    callPromise.then((res) => {
      signal.removeEventListener("abort", onAbort);
      if (!fullText && res?.content) {
         emit("generating", res.content, false);
         fullText = res.content;
      }
      if (!fullReasoning && res?.reasoning_content) {
         emit("thinking", res.reasoning_content, true);
         fullReasoning = res.reasoning_content;
      }
      resolve({ text: fullText, reasoningText: fullReasoning });
    }).catch(err => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}

export async function runAIText(
  settings: AISettingsLike,
  messages: AIMessage[],
  options: RunAITextOptions = {},
) {
  let finalResultText = "";
  await runAITextStream(settings, messages, {
    ...options,
    onUpdate: (update) => {
      if (update.phase === "finishing" || update.phase === "generating" || update.phase === "thinking") {
        if (update.text) {
          finalResultText = update.text;
        }
      }
    }
  });
  return finalResultText;
}

export async function runAITextStream(
  settings: AISettingsLike,
  rawMessages: AIMessage[],
  options: RunAITextStreamOptions = {},
) {
  const messages = rawMessages
    .filter((m) => typeof m.content === "string" && m.content.trim() !== "")
    .map(m => {
      const cleanMessage: any = { role: m.role, content: m.content };
      if ((m as any).reasoning_content) {
         cleanMessage.reasoning_content = (m as any).reasoning_content;
      }
      return cleanMessage;
    });

  const availability = getAIAvailability(settings, options.requestOverrides);
  if (!availability.ok) {
    throw new Error(availability.reason);
  }

  const { provider } = availability;
  const abortController = new AbortController();
  const signal = options.abortSignal ?? abortController.signal;

  let currentPhase: AIStreamPhase = "connecting";
  let contentText = "";
  let reasoningText = "";

  const emit = (phaseMatch: string, contentUpdate: string, isReasoning: boolean) => {
    // Phase flow logic: connecting -> thinking -> generating
    if (currentPhase === "connecting" || (isReasoning && currentPhase !== "thinking")) {
      currentPhase = isReasoning ? "thinking" : "generating";
    }
    // Automatically jump to generating if payload has content and it's not reasoning
    if (!isReasoning && contentUpdate) {
       currentPhase = "generating";
    }

    if (isReasoning) {
       reasoningText += contentUpdate;
    } else {
       contentText += contentUpdate;
    }

    options.onUpdate?.({ phase: currentPhase, text: contentText, reasoningText });
  };

  if (options.onUpdate) {
    options.onUpdate({ phase: "connecting", text: "", reasoningText: "" });
  }

  try {
    let finalChunk;
    if (provider === "utools") {
      finalChunk = await handleUToolsStream(settings, messages, signal, emit, options.requestOverrides);
    } else {
      finalChunk = await handleCustomStream(settings, messages, signal, emit, options.requestOverrides);
    }

    if (options.onUpdate) {
      options.onUpdate({ phase: "finishing", text: finalChunk.text, reasoningText: finalChunk.reasoningText });
    }
    return finalChunk.text;
  } catch (err: any) {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }
    throw err;
  }
}
