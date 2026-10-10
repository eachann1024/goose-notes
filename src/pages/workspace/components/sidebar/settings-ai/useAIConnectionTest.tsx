import { useEffect } from "react";
import { runAIText } from "@/lib/ai-provider";
import {
  hasValidSetupGuideAIResponse,
  isSetupGuideAIRequestCurrent,
  redactSetupGuideAIError,
} from "@/lib/setupGuideAI";
import { CUSTOM_AI_KEY_HINT } from "./shared";
import type { useAIProviderConnection } from "./useAIProviderConnection";

export function useAIConnectionTest(
  input: ReturnType<typeof useAIProviderConnection>,
) {
  const {
    onSetupStateChange,
    ai,
    enabled,
    selectedModelId,
    isOnboarding,
    customBaseURL,
    apiKeyDraft,
    savingCustomConfig,
    customSaveError,
    setTestingConnection,
    setConnectionTestResult,
    setConnectionTestMessage,
    modelSectionRef,
    connectionTestRequestIdRef,
    connectionTestControllerRef,
    connectionTestTimeoutRef,
    isMountedRef,
    setupStateCallbackRef,
    cancelConnectionTest,
    customModels,
    allowCustomBaseURL,
    savedConnection,
    setupAIStatus,
    canTestConnection,
    setupStatusBusy,
    setupStatusDirty,
    setupStatusReady,
  } = input;

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
    !enabled ||
    savingCustomConfig ||
    customModels.length === 0 ||
    (isOnboarding && setupAIStatus.dirty);

  const modelButtonReason =
    isOnboarding && setupAIStatus.dirty
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
  return {
    ...input,
    handleTestConnection,
    hasSetupStateCallback,
    scrollToModelSection,
    saveButtonReason,
    modelButtonDisabled,
    modelButtonReason,
  };
}
