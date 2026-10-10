import { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  getAIProviderPreset,
  getProviderFixedBaseURL,
  getStoredAIModelOptions,
  isAIProviderId,
  resolveProtocolForProvider,
  type AIProviderId,
  type CustomAIProtocol,
} from "@/lib/ai-provider";
import { canTestSetupGuideAI, getSetupGuideAIStatus } from "@/lib/setupGuideAI";
import {
  EMPTY_AI_MODEL_OPTIONS,
  type ProviderConnection,
  readStoredApiKey,
  readStoredBaseURL,
} from "./shared";
import type { useAISettingsDraft } from "./useAISettingsDraft";

export function useAIProviderConnection(
  input: ReturnType<typeof useAISettingsDraft>,
) {
  const {
    visible,
    mode,
    ai,
    enabled,
    selectedModelId,
    setSelectedModelId,
    initialProviderId,
    providerId,
    setProviderId,
    customBaseURL,
    setCustomBaseURL,
    apiKeyDraft,
    setApiKeyDraft,
    savingCustomConfig,
    testingConnection,
    cancelConnectionTest,
  } = input;

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

  const {
    busy: setupStatusBusy,
    dirty: setupStatusDirty,
    ready: setupStatusReady,
  } = setupAIStatus;
  return {
    ...input,
    savedModelIdsSignature,
    previousTestConfigRef,
    storedCustomModels,
    customModels,
    selectedProvider,
    allowCustomBaseURL,
    activeProtocol,
    currentModel,
    getConnectionForProvider,
    savedProviderId,
    savedConnection,
    setupAIStatus,
    canTestConnection,
    setupStatusBusy,
    setupStatusDirty,
    setupStatusReady,
  };
}
