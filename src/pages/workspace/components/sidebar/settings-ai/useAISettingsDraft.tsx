import { useCallback, useEffect, useRef, useState } from "react";
import { isAIProviderId, type AIProviderId } from "@/lib/ai-provider";
import {
  type SettingsAIProps,
  readStoredApiKey,
  readStoredBaseURL,
} from "./shared";

export function useAISettingsDraft({
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
  return {
    visible,
    mode,
    onSetupStateChange,
    ai,
    enabled,
    setEnabled,
    setReadGlobalPrompt,
    setReadLocalSkills,
    selectedModelId,
    setSelectedModelId,
    saveCustomConfig,
    isOnboarding,
    initialProviderId,
    providerId,
    setProviderId,
    customBaseURL,
    setCustomBaseURL,
    apiKeyDraft,
    setApiKeyDraft,
    savingCustomConfig,
    setSavingCustomConfig,
    customSaveError,
    setCustomSaveError,
    apiKeyVisible,
    setApiKeyVisible,
    testingConnection,
    setTestingConnection,
    connectionTestResult,
    setConnectionTestResult,
    connectionTestMessage,
    setConnectionTestMessage,
    modelSectionRef,
    modelRequestIdRef,
    modelAbortControllerRef,
    modelTimeoutRef,
    modelTimedOutRequestIdRef,
    connectionTestRequestIdRef,
    connectionTestControllerRef,
    connectionTestTimeoutRef,
    isMountedRef,
    setupStateCallbackRef,
    cancelModelRefresh,
    cancelConnectionTest,
    previousModelDraftRef,
  };
}
