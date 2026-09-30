import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  fetchCustomAIModels,
  getAIProviderPreset,
  getProviderFixedBaseURL,
  getStoredAIModelOptions,
  isAIProviderId,
  resolveProtocolForProvider,
  runAIText,
  type AIModelOption,
  type AIProviderId,
  type CustomAIProtocol,
} from "@/lib/ai-provider";
import {
  areSetupGuideAIConnectionsEqual,
  canTestSetupGuideAI,
  getSetupGuideAIStatus,
  hasValidSetupGuideAIResponse,
  isSetupGuideAIRequestCurrent,
  redactSetupGuideAIError,
  type SetupGuideAIStatus,
} from "@/lib/setupGuideAI";
import type { AISettings } from "@/stores/useSettings";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { cn } from "@/lib/utils";

interface SettingsAIProps {
  visible?: boolean;
  mode?: "settings" | "onboarding";
  onSetupStateChange?: (status: SetupGuideAIStatus) => void;
  ai: AISettings;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  setReadGlobalPrompt: (enabled: boolean) => void;
  setReadLocalSkills: (enabled: boolean) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  saveCustomConfig: (config: {
    providerId: AIProviderId;
    protocol?: CustomAIProtocol;
    baseURL: string;
    apiKey: string;
    modelOptions: AIModelOption[];
  }) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const CUSTOM_AI_KEY_HINT = "请前往“设置 -> AI 助手 -> AI 服务”补充 API Key";
const EMPTY_AI_MODEL_OPTIONS: AIModelOption[] = [];

/** 供应商菜单图标：与预设文案解耦，避免 presets 依赖 React */
const PROVIDER_ICONS: Record<
  AIProviderId,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  deepseek: LucideIcons.Sparkles,
  glm: LucideIcons.Brain,
  minimax: LucideIcons.AudioLines,
  "custom-openai-responses": LucideIcons.Zap,
  "custom-openai": LucideIcons.Boxes,
  "custom-claude": LucideIcons.MessageSquare,
};

function ProviderIconTile({
  providerId,
  size = "md",
}: {
  providerId: AIProviderId;
  size?: "sm" | "md";
}) {
  const Icon = PROVIDER_ICONS[providerId] ?? LucideIcons.Server;
  const isSm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
        isSm ? "h-6 w-6 rounded-[7px]" : "h-8 w-8",
      )}
      aria-hidden
    >
      <Icon className={isSm ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
    </span>
  );
}

interface ProviderConnection {
  providerId: AIProviderId;
  protocol: CustomAIProtocol;
  baseURL: string;
  apiKey: string;
}

function readStoredApiKey(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  if (providerId === "deepseek") {
    return (
      ai.customOpenAIResponsesApiKey?.trim() ||
      ai.customOpenAIApiKey?.trim() ||
      ""
    );
  }
  if (protocol === "openai-responses")
    return ai.customOpenAIResponsesApiKey || "";
  if (protocol === "openai") return ai.customOpenAIApiKey || "";
  return ai.customClaudeApiKey || "";
}

function readStoredBaseURL(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  const fixed = getProviderFixedBaseURL(providerId);
  if (fixed) return fixed;
  if (protocol === "openai-responses") {
    return ai.customOpenAIResponsesBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  if (protocol === "openai") {
    return ai.customOpenAIBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  return ai.customClaudeBaseURL || DEFAULT_CLAUDE_BASE_URL;
}

export function SettingsAI({
  visible = true,
  mode = "settings",
  onSetupStateChange,
  ai,
  enabled,
  setEnabled,
  setReadGlobalPrompt,
  setReadLocalSkills,
  selectedModelId,
  setSelectedModelId,
  saveCustomConfig,
}: SettingsAIProps) {
  const isOnboarding = mode === "onboarding";
  const initialProviderId: AIProviderId = isAIProviderId(ai.customProviderId)
    ? ai.customProviderId
    : "deepseek";
  const [providerId, setProviderId] = useState<AIProviderId>(initialProviderId);
  const [customBaseURL, setCustomBaseURL] = useState(() =>
    readStoredBaseURL(ai, initialProviderId, ai.customProtocol),
  );
  const [apiKeyDraft, setApiKeyDraft] = useState(() =>
    readStoredApiKey(ai, initialProviderId, ai.customProtocol),
  );
  const [savingCustomConfig, setSavingCustomConfig] = useState(false);
  const [customSaveError, setCustomSaveError] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<
    "idle" | "success" | "failed" | "timeout"
  >("idle");
  const [connectionTestMessage, setConnectionTestMessage] = useState("");
  const modelSectionRef = useRef<HTMLDivElement | null>(null);
  const modelRequestIdRef = useRef(0);
  const modelAbortControllerRef = useRef<AbortController | null>(null);
  const modelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelTimedOutRequestIdRef = useRef<number | null>(null);
  const connectionTestRequestIdRef = useRef(0);
  const connectionTestControllerRef = useRef<AbortController | null>(null);
  const connectionTestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(false);
  const setupStateCallbackRef = useRef(onSetupStateChange);
  useEffect(() => {
    setupStateCallbackRef.current = onSetupStateChange;
  }, [onSetupStateChange]);

  const cancelModelRefresh = useCallback(() => {
    const controller = modelAbortControllerRef.current;
    if (!controller) return;

    modelRequestIdRef.current += 1;
    controller.abort();
    modelAbortControllerRef.current = null;
    modelTimedOutRequestIdRef.current = null;
    if (modelTimeoutRef.current) clearTimeout(modelTimeoutRef.current);
    modelTimeoutRef.current = null;
    if (isMountedRef.current) setSavingCustomConfig(false);
  }, []);

  const cancelConnectionTest = useCallback(() => {
    connectionTestRequestIdRef.current += 1;
    connectionTestControllerRef.current?.abort();
    connectionTestControllerRef.current = null;
    if (connectionTestTimeoutRef.current) {
      clearTimeout(connectionTestTimeoutRef.current);
    }
    connectionTestTimeoutRef.current = null;
    if (isMountedRef.current) {
      setTestingConnection(false);
      setConnectionTestResult("idle");
      setConnectionTestMessage("");
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      modelRequestIdRef.current += 1;
      connectionTestRequestIdRef.current += 1;
      if (modelTimeoutRef.current) clearTimeout(modelTimeoutRef.current);
      if (connectionTestTimeoutRef.current) {
        clearTimeout(connectionTestTimeoutRef.current);
      }
      modelAbortControllerRef.current?.abort();
      connectionTestControllerRef.current?.abort();
      modelTimeoutRef.current = null;
      connectionTestTimeoutRef.current = null;
      modelAbortControllerRef.current = null;
      connectionTestControllerRef.current = null;
    };
  }, []);

  const previousModelDraftRef = useRef({
    providerId,
    customBaseURL,
    apiKeyDraft,
    selectedModelId,
  });
  useEffect(() => {
    const previous = previousModelDraftRef.current;
    const changed =
      previous.providerId !== providerId ||
      previous.customBaseURL !== customBaseURL ||
      previous.apiKeyDraft !== apiKeyDraft ||
      previous.selectedModelId !== selectedModelId;
    previousModelDraftRef.current = {
      providerId,
      customBaseURL,
      apiKeyDraft,
      selectedModelId,
    };
    if (isOnboarding && changed) cancelModelRefresh();
  }, [
    apiKeyDraft,
    cancelModelRefresh,
    customBaseURL,
    isOnboarding,
    providerId,
    selectedModelId,
  ]);

  const savedModelIdsSignature = ai.customModelOptions
    .map((model) => model.id)
    .join("\u0000");
  const previousTestConfigRef = useRef<{
    mode: string;
    enabled: boolean;
    providerId: AIProviderId;
    baseURL: string;
    apiKey: string;
    selectedModelId: string | null;
    savedProviderId: AIProviderId;
    savedProtocol: CustomAIProtocol;
    responsesBaseURL: string;
    openAIBaseURL: string;
    claudeBaseURL: string;
    responsesApiKey: string;
    openAIApiKey: string;
    claudeApiKey: string;
    savedModelIds: string;
  } | null>(null);
  useEffect(() => {
    const savedProviderId = isAIProviderId(ai.customProviderId)
      ? ai.customProviderId
      : initialProviderId;
    const next = {
      mode,
      enabled,
      providerId,
      baseURL: customBaseURL,
      apiKey: apiKeyDraft,
      selectedModelId,
      savedProviderId,
      savedProtocol: ai.customProtocol,
      responsesBaseURL: ai.customOpenAIResponsesBaseURL,
      openAIBaseURL: ai.customOpenAIBaseURL,
      claudeBaseURL: ai.customClaudeBaseURL,
      responsesApiKey: ai.customOpenAIResponsesApiKey,
      openAIApiKey: ai.customOpenAIApiKey,
      claudeApiKey: ai.customClaudeApiKey,
      savedModelIds: savedModelIdsSignature,
    };
    const previous = previousTestConfigRef.current;
    previousTestConfigRef.current = next;
    if (
      mode === "onboarding" &&
      previous &&
      Object.keys(next).some(
        (key) =>
          next[key as keyof typeof next] !==
          previous[key as keyof typeof previous],
      )
    ) {
      cancelConnectionTest();
    }
  }, [
    ai.customClaudeApiKey,
    ai.customClaudeBaseURL,
    ai.customOpenAIApiKey,
    ai.customOpenAIBaseURL,
    ai.customOpenAIResponsesApiKey,
    ai.customOpenAIResponsesBaseURL,
    ai.customProtocol,
    ai.customProviderId,
    apiKeyDraft,
    cancelConnectionTest,
    customBaseURL,
    enabled,
    initialProviderId,
    mode,
    providerId,
    savedModelIdsSignature,
    selectedModelId,
  ]);

  const storedCustomModels = getStoredAIModelOptions(ai);
  const customModels =
    providerId === ai.customProviderId
      ? storedCustomModels
      : EMPTY_AI_MODEL_OPTIONS;

  const selectedProvider = useMemo(
    () => getAIProviderPreset(providerId),
    [providerId],
  );
  const allowCustomBaseURL = selectedProvider.allowCustomBaseURL;
  const activeProtocol = resolveProtocolForProvider(
    providerId,
    selectedModelId,
    selectedProvider.protocol,
  );

  useEffect(() => {
    const nextProvider = isAIProviderId(ai.customProviderId)
      ? ai.customProviderId
      : "deepseek";
    setProviderId(nextProvider);
    setCustomBaseURL(readStoredBaseURL(ai, nextProvider, ai.customProtocol));
    setApiKeyDraft(readStoredApiKey(ai, nextProvider, ai.customProtocol));
  }, [
    ai.customProviderId,
    ai.customProtocol,
    ai.customOpenAIResponsesBaseURL,
    ai.customOpenAIBaseURL,
    ai.customClaudeBaseURL,
    ai.customOpenAIResponsesApiKey,
    ai.customOpenAIApiKey,
    ai.customClaudeApiKey,
  ]);

  useEffect(() => {
    if (!visible || customModels.length === 0) {
      return;
    }

    if (
      !selectedModelId ||
      !customModels.some((item) => item.id === selectedModelId)
    ) {
      setSelectedModelId(customModels[0].id);
    }
  }, [customModels, selectedModelId, setSelectedModelId, visible]);

  const currentModel =
    customModels.find((item) => item.id === selectedModelId) ?? null;

  const getConnectionForProvider = (
    nextProviderId: AIProviderId,
    nextApiKey = apiKeyDraft,
    nextBaseURL = customBaseURL,
  ): ProviderConnection => {
    const preset = getAIProviderPreset(nextProviderId);
    const protocol = resolveProtocolForProvider(
      nextProviderId,
      selectedModelId,
      preset.protocol,
    );
    const fixed = getProviderFixedBaseURL(nextProviderId);
    const fallback =
      protocol === "claude" ? DEFAULT_CLAUDE_BASE_URL : DEFAULT_OPENAI_BASE_URL;
    const baseURL = ((fixed ?? nextBaseURL.trim()) || fallback).replace(
      /\/+$/,
      "",
    );
    return {
      providerId: nextProviderId,
      protocol,
      baseURL: baseURL || fallback,
      apiKey: nextApiKey,
    };
  };

  const savedProviderId = isAIProviderId(ai.customProviderId)
    ? ai.customProviderId
    : initialProviderId;
  const savedConnection = {
    providerId: savedProviderId,
    baseURL: readStoredBaseURL(ai, savedProviderId, ai.customProtocol),
    apiKey: readStoredApiKey(ai, savedProviderId, ai.customProtocol),
  };
  const setupAIStatus = getSetupGuideAIStatus({
    busy: savingCustomConfig || testingConnection,
    draft: getConnectionForProvider(providerId),
    saved: savedConnection,
    selectedModelId,
    modelOptions: storedCustomModels,
  });
  const canTestConnection = canTestSetupGuideAI(enabled, setupAIStatus);
  const { busy: setupStatusBusy, dirty: setupStatusDirty, ready: setupStatusReady } =
    setupAIStatus;

  const handleTestConnection = async () => {
    if (!canTestConnection || !selectedModelId) return;

    cancelConnectionTest();
    const controller = new AbortController();
    const requestId = connectionTestRequestIdRef.current + 1;
    connectionTestRequestIdRef.current = requestId;
    connectionTestControllerRef.current = controller;
    setTestingConnection(true);
    setConnectionTestResult("idle");
    setConnectionTestMessage("");

    const timeoutId = setTimeout(() => {
      if (
        requestId !== connectionTestRequestIdRef.current ||
        !isMountedRef.current
      ) {
        return;
      }
      controller.abort();
      connectionTestRequestIdRef.current += 1;
      connectionTestControllerRef.current = null;
      connectionTestTimeoutRef.current = null;
      setTestingConnection(false);
      setConnectionTestResult("timeout");
      setConnectionTestMessage("连接测试超时（30 秒），请检查配置后重试。");
    }, 30_000);
    connectionTestTimeoutRef.current = timeoutId;

    try {
      const response = await runAIText(
        {
          ...ai,
          enabled,
          selectedModelId,
          workspaceReasoningLevel: "default",
        },
        [{ role: "user", content: "请只回复“连接成功”。" }],
        {
          abortSignal: controller.signal,
          requestOverrides: {
            selectedModelId,
            reasoningLevel: "default",
          },
        },
      );

      if (
        !isSetupGuideAIRequestCurrent({
          requestId,
          currentRequestId: connectionTestRequestIdRef.current,
          alive: isMountedRef.current,
          signal: controller.signal,
        })
      ) {
        return;
      }

      if (hasValidSetupGuideAIResponse(response)) {
        setConnectionTestResult("success");
        setConnectionTestMessage("连接成功。");
      } else {
        setConnectionTestResult("failed");
        setConnectionTestMessage("连接失败：服务未返回有效文本。");
      }
    } catch (error) {
      if (
        !isMountedRef.current ||
        requestId !== connectionTestRequestIdRef.current ||
        controller.signal.aborted
      ) {
        return;
      }
      const rawMessage =
        error instanceof Error ? error.message : "连接失败，请检查配置后重试。";
      const safeMessage = redactSetupGuideAIError(
        rawMessage,
        savedConnection.apiKey,
      );
      setConnectionTestResult("failed");
      setConnectionTestMessage(safeMessage || "连接失败，请检查配置后重试。");
    } finally {
      if (requestId === connectionTestRequestIdRef.current) {
        clearTimeout(timeoutId);
        if (connectionTestTimeoutRef.current === timeoutId) {
          connectionTestTimeoutRef.current = null;
        }
        connectionTestControllerRef.current = null;
        if (isMountedRef.current) setTestingConnection(false);
      }
    }
  };

  const hasSetupStateCallback = Boolean(onSetupStateChange);
  useEffect(() => {
    if (!isOnboarding) return;
    setupStateCallbackRef.current?.({
      busy: setupStatusBusy,
      dirty: setupStatusDirty,
      ready: setupStatusReady,
    });
  }, [
    hasSetupStateCallback,
    isOnboarding,
    setupStatusBusy,
    setupStatusDirty,
    setupStatusReady,
  ]);

  const scrollToModelSection = () => {
    requestAnimationFrame(() => {
      const target = modelSectionRef.current;
      if (!target) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    });
  };

  const saveButtonReason = savingCustomConfig
    ? "正在保存并读取模型列表"
    : !apiKeyDraft.trim()
      ? CUSTOM_AI_KEY_HINT
      : allowCustomBaseURL && !customBaseURL.trim()
        ? "请填写 Base URL"
        : null;

  const modelButtonDisabled =
    !enabled || savingCustomConfig || customModels.length === 0 ||
    (isOnboarding && setupAIStatus.dirty);

  const modelButtonReason = isOnboarding && setupAIStatus.dirty
    ? "请先保存当前服务配置"
    : !enabled
    ? "先打开 AI 助手开关后才能选择模型"
    : savingCustomConfig
      ? "模型列表读取中，请稍候"
      : customSaveError
        ? customSaveError
        : customModels.length === 0
          ? "请先填写 API Key 并保存配置"
          : null;

  const refreshCustomModels = async (
    connection: ProviderConnection,
    action: "save" | "switch" | "refresh",
  ) => {
    const apiKey = connection.apiKey.trim();
    if (!apiKey) {
      toast.error(CUSTOM_AI_KEY_HINT);
      return;
    }

    const provider = getAIProviderPreset(connection.providerId);
    if (isOnboarding) cancelModelRefresh();
    const requestId = ++modelRequestIdRef.current;
    const controller = isOnboarding ? new AbortController() : null;
    if (controller) {
      modelAbortControllerRef.current = controller;
      modelTimedOutRequestIdRef.current = null;
      modelTimeoutRef.current = setTimeout(() => {
        if (
          requestId !== modelRequestIdRef.current ||
          !isMountedRef.current
        ) {
          return;
        }
        modelTimedOutRequestIdRef.current = requestId;
        controller.abort();
      }, 30_000);
    }
    setSavingCustomConfig(true);
    setCustomSaveError(null);

    // 先持久化供应商 / Key / Base URL，避免拉模型失败时配置丢失。
    const sameSavedConnection = areSetupGuideAIConnectionsEqual(
      { ...connection, apiKey },
      savedConnection,
    );
    const previousModelOptions = sameSavedConnection ? storedCustomModels : [];
    saveCustomConfig({
      providerId: connection.providerId,
      protocol: connection.protocol,
      baseURL: connection.baseURL,
      apiKey,
      modelOptions: previousModelOptions,
    });

    try {
      // DeepSeek 模型列表走兼容 /models；协议按模型在请求时分支。
      const listProtocol: CustomAIProtocol =
        connection.providerId === "deepseek" ? "openai" : connection.protocol;
      const modelOptions = await fetchCustomAIModels({
        protocol: listProtocol,
        baseURL: connection.baseURL,
        apiKey,
        providerId: connection.providerId,
        signal: controller?.signal,
      });
      if (
        !isMountedRef.current ||
        requestId !== modelRequestIdRef.current ||
        controller?.signal.aborted
      ) {
        return;
      }

      const nextModel =
        modelOptions.find((model) => model.id === selectedModelId) ??
        modelOptions[0] ??
        null;
      const nextProtocol = resolveProtocolForProvider(
        connection.providerId,
        nextModel?.id ?? null,
        connection.protocol,
      );

      saveCustomConfig({
        providerId: connection.providerId,
        protocol: nextProtocol,
        baseURL: connection.baseURL,
        apiKey,
        modelOptions,
      });

      setSelectedModelId(nextModel?.id ?? null);
      scrollToModelSection();

      if (modelOptions.length === 0) {
        toast.warning(`${provider.label} 配置已保存`, {
          description: "已获取 0 个模型，请确认该服务是否提供模型列表接口。",
        });
      } else {
        const actionLabel =
          action === "switch"
            ? `已切换到 ${provider.label}`
            : action === "refresh"
              ? `${provider.label} 模型列表已更新`
              : `${provider.label} 配置已保存`;
        toast.success(actionLabel, {
          description: `已获取 ${modelOptions.length} 个模型，默认选择 ${nextModel?.label ?? nextModel?.id}。`,
        });
      }
    } catch (error) {
      if (
        !isMountedRef.current ||
        requestId !== modelRequestIdRef.current
      ) {
        return;
      }
      const timedOut = modelTimedOutRequestIdRef.current === requestId;
      if (controller?.signal.aborted && !timedOut) return;
      const rawMessage =
        error instanceof Error ? error.message : "获取模型列表失败";
      const message = timedOut
        ? "获取模型列表超时（30 秒），配置已保存，可重试。"
        : redactSetupGuideAIError(rawMessage, apiKey) || "获取模型列表失败";
      setCustomSaveError(message);
      toast.error(message, {
        description:
          action === "refresh"
            ? "模型列表未更新，已保留当前配置。"
            : "API Key 已保存，模型列表未能更新。",
      });
    } finally {
      if (requestId === modelRequestIdRef.current) {
        if (modelTimeoutRef.current) clearTimeout(modelTimeoutRef.current);
        modelTimeoutRef.current = null;
        modelTimedOutRequestIdRef.current = null;
        modelAbortControllerRef.current = null;
        if (isMountedRef.current) setSavingCustomConfig(false);
      }
    }
  };

  const handleSaveCustomConfig = async () => {
    if (saveButtonReason) {
      toast.error(saveButtonReason);
      return;
    }
    await refreshCustomModels(getConnectionForProvider(providerId), "save");
  };

  const handleProviderChange = (value: string) => {
    if (!isAIProviderId(value) || value === providerId) return;
    setCustomSaveError(null);
    if (isOnboarding) {
      cancelModelRefresh();
      cancelConnectionTest();
      setProviderId(value);

      const nextPreset = getAIProviderPreset(value);
      const nextBaseURL =
        getProviderFixedBaseURL(value) ??
        (nextPreset.protocol === "claude"
          ? DEFAULT_CLAUDE_BASE_URL
          : DEFAULT_OPENAI_BASE_URL);
      setCustomBaseURL(nextBaseURL);
      // Credential slots are shared by protocol, not by provider. Never carry
      // a draft key over to a different host before the user saves explicitly.
      setApiKeyDraft("");
      return;
    }

    setProviderId(value);

    const nextPreset = getAIProviderPreset(value);
    const nextBaseURL =
      getProviderFixedBaseURL(value) ??
      (nextPreset.protocol === "claude"
        ? DEFAULT_CLAUDE_BASE_URL
        : DEFAULT_OPENAI_BASE_URL);
    setCustomBaseURL(nextBaseURL);

    // 仅当切回当前已保存供应商时复用草稿 Key；否则只读该供应商在 store 中的 Key，避免串用。
    const finalKey =
      value === ai.customProviderId
        ? apiKeyDraft
        : readStoredApiKey(ai, value, nextPreset.protocol);
    setApiKeyDraft(finalKey);

    if (!finalKey.trim()) {
      toast.info(`已切换到 ${nextPreset.label}`, {
        description: "填写 API Key 并保存后，将自动获取模型列表。",
      });
      return;
    }

    void refreshCustomModels(
      getConnectionForProvider(value, finalKey, nextBaseURL),
      "switch",
    );
  };

  const handleModelChange = (modelId: string) => {
    if (isOnboarding) cancelConnectionTest();
    setCustomSaveError(null);
    setSelectedModelId(modelId);
    // DeepSeek 选 Pro/Flash 时协议会变；若已有 Key，同步持久化协议槽位。
    if (providerId !== "deepseek" || !apiKeyDraft.trim()) return;
    const connection = getConnectionForProvider(providerId);
    const protocol = resolveProtocolForProvider(
      providerId,
      modelId,
      connection.protocol,
    );
    saveCustomConfig({
      providerId,
      protocol,
      baseURL: connection.baseURL,
      apiKey: connection.apiKey.trim(),
      modelOptions: customModels,
    });
  };

  const enabledSection = (
    <SettingsSectionCard
      className={isOnboarding ? "p-4" : undefined}
      contentClassName={isOnboarding ? "space-y-3" : undefined}
    >
        <div
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            SETTINGS_OPTION_ROW_CLASS,
          )}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <LucideIcons.Sparkles className="h-4 w-4 text-current" />
              <Label
                htmlFor="ai-enabled"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                启用 AI 写作助手
              </Label>
            </div>
            <div className="text-xs leading-5 text-muted-foreground">
              关闭后隐藏所有 AI 入口，并停止当前生成。
            </div>
          </div>
          <Switch
            id="ai-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
    </SettingsSectionCard>
  );

  const modelSection = (
    <div
        ref={modelSectionRef}
        id="ai-model-settings"
        tabIndex={-1}
        className="scroll-mt-6 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <SettingsSectionCard
          className={isOnboarding ? "p-4" : undefined}
          title={
            <span className="flex items-center gap-2">
              <LucideIcons.Brain
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              AI 模型
            </span>
          }
          description={
            <span className="block">
              选择全局默认模型
              <span
                className="mt-1 block font-medium text-foreground/75"
                role="status"
                aria-live="polite"
              >
                {savingCustomConfig
                  ? "正在获取模型列表…"
                  : customSaveError
                    ? `获取失败：${customSaveError}`
                    : customModels.length > 0
                      ? `已获取 ${customModels.length} 个${currentModel ? ` · ${currentModel.label}` : ""}`
                      : "尚未获取到模型"}
              </span>
            </span>
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              disabled={Boolean(saveButtonReason) || testingConnection}
              onClick={() => {
                void refreshCustomModels(
                  getConnectionForProvider(providerId),
                  "refresh",
                );
              }}
            >
              {savingCustomConfig ? (
                <LucideIcons.LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LucideIcons.RefreshCw className="h-4 w-4" />
              )}
              {savingCustomConfig ? "获取中…" : "重新获取模型"}
            </Button>
          }
        >
          <div className="space-y-3">
            <div
              className={cn(
                "settings-ai-pick-row flex items-center justify-between gap-4 p-4",
                SETTINGS_OPTION_ROW_CLASS,
              )}
            >
              <div className="flex items-center gap-3">
                <LucideIcons.Cpu
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">
                    默认模型
                  </Label>
                </div>
              </div>
              <TooltipProvider delayDuration={600}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={modelButtonDisabled}
                            className={cn(
                              "min-w-[220px] justify-between rounded-[10px]",
                              modelButtonDisabled && "cursor-not-allowed",
                            )}
                          >
                            <span className="truncate">
                              {currentModel?.label ??
                                modelButtonReason ??
                                "请选择模型"}
                            </span>
                            <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[280px]"
                          style={{
                            maxHeight: "min(360px, var(--available-height))",
                          }}
                        >
                          <DropdownMenuRadioGroup
                            value={selectedModelId ?? ""}
                            onValueChange={handleModelChange}
                          >
                            {customModels.map((model) => (
                              <DropdownMenuRadioItem
                                key={model.id}
                                value={model.id}
                                className="items-start gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {model.label}
                                  </div>
                                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {model.description || model.id}
                                  </div>
                                </div>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TooltipTrigger>
                  {modelButtonReason ? (
                    <TooltipContent side="left">
                      {modelButtonReason}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </SettingsSectionCard>
    </div>
  );

  const contextSection = (
    <SettingsSectionCard
        className={isOnboarding ? "p-4" : undefined}
        title={
          <span className="flex items-center gap-2">
            <LucideIcons.FolderCog
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            本地 AI 上下文
          </span>
        }
        description="开启后，全局提示词与本地 Skill 会参与 AI 对话。"
      >
        <div className="space-y-2">
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="space-y-1">
              <Label
                htmlFor="ai-read-global-prompt"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                读取全局提示词
              </Label>
              <div className="text-xs leading-5 text-muted-foreground">
                并入 AI 系统提示词
              </div>
            </div>
            <Switch
              id="ai-read-global-prompt"
              checked={ai.readGlobalPrompt}
              onCheckedChange={setReadGlobalPrompt}
            />
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="space-y-1">
              <Label
                htmlFor="ai-read-local-skills"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                读取本地 Skill
              </Label>
              <div className="text-xs leading-5 text-muted-foreground">
                输入 / 调用
              </div>
            </div>
            <Switch
              id="ai-read-local-skills"
              checked={ai.readLocalSkills}
              onCheckedChange={setReadLocalSkills}
            />
          </div>
        </div>
      </SettingsSectionCard>
  );

  const serviceSection = (
    <SettingsSectionCard
        className={isOnboarding ? "p-4" : undefined}
        title={
          <span className="flex items-center gap-2">
            <LucideIcons.Bot
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            AI 服务
          </span>
        }
        description="选择供应商，只需填写 API Key。"
      >
        <div className="space-y-3">
          <div className="space-y-3">
            <div
              className={cn(
                "settings-ai-pick-row flex items-center justify-between gap-4 p-4",
                SETTINGS_OPTION_ROW_CLASS,
              )}
            >
              <div className="flex items-center gap-3">
                <ProviderIconTile providerId={providerId} />
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">
                    供应商
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {selectedProvider.description}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingCustomConfig || testingConnection}
                    className="min-w-[200px] justify-between rounded-[10px] px-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ProviderIconTile providerId={providerId} size="sm" />
                      <span className="truncate">{selectedProvider.label}</span>
                    </span>
                    <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[288px] p-1.5">
                  {AI_PROVIDER_PRESETS.map((option) => {
                    const selected = option.id === providerId;
                    return (
                      <DropdownMenuItem
                        key={option.id}
                        onSelect={() => handleProviderChange(option.id)}
                        className={cn(
                          "cursor-pointer gap-2.5 rounded-[10px] px-2 py-2",
                          selected &&
                            "bg-[var(--goose-interactive-selected)] text-foreground",
                        )}
                      >
                        <ProviderIconTile providerId={option.id} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium leading-5 text-foreground">
                            {option.label}
                          </div>
                          <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                        <LucideIcons.Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-foreground",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                          strokeWidth={2}
                          aria-hidden={!selected}
                        />
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {allowCustomBaseURL ? (
              <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
                <div className="flex items-center gap-3">
                  <LucideIcons.Globe
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <Label
                    htmlFor="custom-ai-base-url"
                    className="text-sm font-medium text-foreground"
                  >
                    Base URL
                  </Label>
                </div>
                <Input
                  id="custom-ai-base-url"
                  value={customBaseURL}
                  onChange={(event) => {
                    if (isOnboarding) {
                      cancelModelRefresh();
                      cancelConnectionTest();
                    }
                    setCustomSaveError(null);
                    setCustomBaseURL(event.target.value);
                  }}
                  placeholder={
                    activeProtocol === "claude"
                      ? DEFAULT_CLAUDE_BASE_URL
                      : DEFAULT_OPENAI_BASE_URL
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}

            <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
              <div className="flex items-center gap-3">
                <LucideIcons.KeyRound
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <Label
                  htmlFor="custom-ai-api-key"
                  className="text-sm font-medium text-foreground"
                >
                  API Key
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="custom-ai-api-key"
                  type={apiKeyVisible ? "text" : "password"}
                  value={apiKeyDraft}
                  onChange={(event) => {
                    if (isOnboarding) {
                      cancelModelRefresh();
                      cancelConnectionTest();
                    }
                    setCustomSaveError(null);
                    setApiKeyDraft(event.target.value);
                  }}
                  placeholder="输入后点保存自动拉取模型"
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] hover:bg-[var(--goose-interactive-hover)]"
                  onClick={() => setApiKeyVisible((visible) => !visible)}
                  aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                  aria-pressed={apiKeyVisible}
                >
                  {apiKeyVisible ? (
                    <LucideIcons.EyeOff
                      className="h-4 w-4"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <LucideIcons.Eye className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-4 p-4",
                SETTINGS_OPTION_ROW_CLASS,
              )}
            >
              <div className="flex items-center gap-3">
                <LucideIcons.Download
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">
                    保存配置
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {allowCustomBaseURL
                      ? "保存 Base URL 与 API Key，并自动拉取可用模型列表。"
                      : "保存 API Key，并自动拉取可用模型列表。"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TooltipProvider delayDuration={600}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          size="sm"
                          disabled={Boolean(saveButtonReason) || testingConnection}
                          onClick={() => {
                            void handleSaveCustomConfig();
                          }}
                          className={cn(
                            Boolean(saveButtonReason) && "cursor-not-allowed",
                          )}
                        >
                          {!savingCustomConfig && (
                            <LucideIcons.Save className="h-4 w-4" />
                          )}
                          {savingCustomConfig
                            ? "获取模型中…"
                            : isOnboarding
                              ? "保存并获取模型"
                              : "保存"}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {saveButtonReason ? (
                      <TooltipContent side="left">
                        {saveButtonReason}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
                {isOnboarding && savingCustomConfig ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelModelRefresh}
                  >
                    取消获取
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
  );

  const connectionTestSection = isOnboarding ? (
    <SettingsSectionCard
      className="p-4"
      title="连接测试"
      description="仅发送固定测试文本，不读取笔记、全局提示词或本地 Skill。"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canTestConnection}
          onClick={() => void handleTestConnection()}
        >
          {testingConnection ? (
            <LucideIcons.LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <LucideIcons.PlugZap className="h-4 w-4" />
          )}
          {testingConnection ? "测试中…" : "测试连接"}
        </Button>
        {testingConnection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelConnectionTest}
          >
            取消测试
          </Button>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-sm",
          connectionTestResult === "success"
            ? "text-foreground"
            : connectionTestResult === "failed" ||
                connectionTestResult === "timeout"
              ? "text-destructive"
              : "text-muted-foreground",
        )}
        role="status"
        aria-live="polite"
      >
        {testingConnection
          ? "正在测试连接…"
          : connectionTestResult !== "idle"
            ? connectionTestMessage
            : !enabled
              ? "启用 AI 并保存配置、获取模型后可测试连接。"
              : setupAIStatus.dirty
                ? "请先保存当前服务商配置。"
                : !setupAIStatus.ready
                  ? "请先保存配置并获取可用模型。"
                  : "测试不会读取笔记或本地上下文。"}
      </p>
    </SettingsSectionCard>
  ) : null;

  if (isOnboarding) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3">
        {enabledSection}
        {serviceSection}
        {modelSection}
        {connectionTestSection}
        <details className="rounded-lg border border-border bg-background/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            高级选项
          </summary>
          <div className="pt-3">{contextSection}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        AI 助手
      </h3>
      <div className="settings-card-columns">
        <div className="space-y-5">
          {enabledSection}
          {modelSection}
          {contextSection}
        </div>
        <div className="space-y-5">{serviceSection}</div>
      </div>
    </div>
  );
}
