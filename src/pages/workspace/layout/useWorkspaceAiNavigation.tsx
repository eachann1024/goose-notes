import { useCallback, useEffect } from "react";
import { isFullscreenAiLayout } from "../components/notebook-ai/useNotebookAiPanel";
import { subscribePageTitleFocus } from "@/lib/page-title-focus";
import { useWorkspaceViewport } from "@/stores/useWorkspaceViewport";
import type { useWorkspaceSettingsNavigation } from "./useWorkspaceSettingsNavigation";

export function useWorkspaceAiNavigation(
  input: ReturnType<typeof useWorkspaceSettingsNavigation>,
) {
  const {
    aiPanelOpen,
    aiLayoutMode,
    setAiLayoutMode,
    openAiPanel,
    toggleAiPanel,
    closeAiPanel,
    aiFullscreen,
    forceCollapseRight,
    rightExpandOverride,
    aiAvailableForNotebook,
    settingsOpen,
    focusAiAfterSettingsCloseRef,
    closeSettings,
  } = input;

  const handleToggleAiPanel = useCallback(() => {
    if (!aiAvailableForNotebook) return;
    // Mark the handoff before closing. The close listener and this handler
    // can both run in one turn; the layout effect consumes the flag after
    // settings are actually gone.
    if (settingsOpen) focusAiAfterSettingsCloseRef.current = true;
    closeSettings();
    const vp = useWorkspaceViewport.getState();
    if (settingsOpen) {
      if (!aiPanelOpen) openAiPanel();
      if (!aiFullscreen && vp.forceCollapseRight) {
        vp.setRightExpandOverride(true);
      }
      return;
    }
    if (!aiFullscreen && vp.forceCollapseRight) {
      if (!aiPanelOpen) {
        openAiPanel();
        vp.setRightExpandOverride(true);
        window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
        return;
      }
      const nextOverride = !vp.rightExpandOverride;
      vp.setRightExpandOverride(nextOverride);
      if (nextOverride) {
        window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
      }
      return;
    }
    toggleAiPanel();
    if (!aiPanelOpen) {
      window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
    }
  }, [
    closeSettings,
    settingsOpen,
    aiAvailableForNotebook,
    aiFullscreen,
    aiPanelOpen,
    openAiPanel,
    toggleAiPanel,
  ]);

  // Mod+J 快捷键（useAppHotkeys 派发）→ 开关 AI 面板，与 UI 按钮门控一致：未启用 AI 时不响应
  useEffect(() => {
    const onToggle = () => {
      handleToggleAiPanel();
    };
    window.addEventListener("goose-note:toggle-ai-panel", onToggle);
    return () =>
      window.removeEventListener("goose-note:toggle-ai-panel", onToggle);
  }, [handleToggleAiPanel]);

  // 极简工作区的新建页会直接进入标题编辑。若此时 AI 正以全屏覆盖主区域，
  // 必须同步退出 AI，否则只会看到页头标题框，正文仍错误地停留在 AI 会话。
  useEffect(
    () =>
      subscribePageTitleFocus(() => {
        if (aiPanelOpen && isFullscreenAiLayout(aiLayoutMode)) {
          closeAiPanel();
        }
      }),
    [aiLayoutMode, aiPanelOpen, closeAiPanel],
  );

  // 编辑器内的显式面板事件统一走此入口。
  // 使用 open 而非 toggle，重复触发不会把已经打开的面板关掉。
  useEffect(() => {
    const onOpen = (event: Event) => {
      if (!aiAvailableForNotebook) return;
      const detail = (event as CustomEvent<unknown>).detail;
      const record =
        detail && typeof detail === "object"
          ? (detail as Record<string, unknown>)
          : null;
      if (record?.layout === "side-panel") {
        setAiLayoutMode("side-panel");
      }
      const capture =
        record &&
        record.version === 1 &&
        typeof record.pageId === "string" &&
        Boolean(record.selection)
          ? (detail as Parameters<typeof openAiPanel>[0])
          : null;
      openAiPanel(capture);
      if (useWorkspaceViewport.getState().forceCollapseRight) {
        useWorkspaceViewport.getState().setRightExpandOverride(true);
      }
      // 面板已打开时重复触发「打开」不会重挂载，补发聚焦事件让输入框重新获焦；
      // 首次挂载时面板自身会聚焦，此事件无害。
      window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
    };
    window.addEventListener("goose-note:open-ai-panel", onOpen);
    return () => window.removeEventListener("goose-note:open-ai-panel", onOpen);
  }, [aiAvailableForNotebook, openAiPanel, setAiLayoutMode]);

  // AI 功能不可用时强制收起侧栏面板，避免 localStorage 仍为 true 导致下次误展开
  useEffect(() => {
    if (!aiAvailableForNotebook) closeAiPanel();
  }, [aiAvailableForNotebook, closeAiPanel]);
  return { ...input, handleToggleAiPanel };
}
