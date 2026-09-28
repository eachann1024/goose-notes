import { useCallback, useLayoutEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { isSetupGuideVisible } from "@/lib/setupGuide";
import type { SetupGuideAIStatus } from "@/lib/setupGuideAI";
import { useSettings } from "@/stores/useSettings";
import { AppearanceEditorPreview } from "./sidebar/AppearanceEditorPreview";
import { SettingsAI } from "./sidebar/SettingsAI";
import { SettingsAppearance } from "./sidebar/SettingsAppearance";
import { WinWindowControls } from "./page/WinWindowControls";
import "./setup-guide.css";

const STEPS = [
  { label: "外观", title: "设置外观" },
  { label: "阅读", title: "调整阅读体验" },
  { label: "AI", title: "配置 AI 助手" },
] as const;

type SetupStep = 0 | 1 | 2;

const INITIAL_AI_STATUS: SetupGuideAIStatus = {
  busy: false,
  dirty: false,
  ready: false,
};

export function canFinishSetupGuideAI(
  aiEnabled: boolean,
  status: SetupGuideAIStatus,
): boolean {
  return !aiEnabled || (!status.busy && !status.dirty && status.ready);
}

function getNativePlatform(): "mac" | "win" | "web" {
  if (!isElectronRuntime() || typeof navigator === "undefined") return "web";
  if (/Mac/i.test(navigator.platform)) return "mac";
  if (/Win/i.test(navigator.platform)) return "win";
  return "web";
}

export function SetupGuide() {
  const visible = useSettings((settings) => isSetupGuideVisible(settings));
  return visible ? <SetupGuideFlow /> : null;
}

function SetupGuideFlow() {
  const appearance = useSettings(
    useShallow((settings) => ({
      theme: settings.theme,
      setTheme: settings.setTheme,
      accentColor: settings.accentColor,
      setAccentColor: settings.setAccentColor,
      customFonts: settings.customFonts,
      setCustomFont: settings.setCustomFont,
      uiFontSize: settings.uiFontSize,
      setUIFontSize: settings.setUIFontSize,
      sidebarFontSize: settings.sidebarFontSize,
      increaseSidebarFontSize: settings.increaseSidebarFontSize,
      decreaseSidebarFontSize: settings.decreaseSidebarFontSize,
      editorFontSize: settings.editorFontSize,
      editorLineHeight: settings.editorLineHeight,
      increaseEditorFontSize: settings.increaseEditorFontSize,
      decreaseEditorFontSize: settings.decreaseEditorFontSize,
    })),
  );
  const aiSettings = useSettings(
    useShallow((settings) => ({
      ai: settings.ai,
      setAIEnabled: settings.setAIEnabled,
      setAIReadGlobalPrompt: settings.setAIReadGlobalPrompt,
      setAIReadLocalSkills: settings.setAIReadLocalSkills,
      setAISelectedModelId: settings.setAISelectedModelId,
      saveAICustomConfig: settings.saveAICustomConfig,
    })),
  );
  const [step, setStep] = useState<SetupStep>(0);
  const [hasVisitedAI, setHasVisitedAI] = useState(false);
  const [aiStatus, setAIStatus] = useState(INITIAL_AI_STATUS);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const controlsRef = useRef<HTMLElement | null>(null);
  const onAISetupStateChange = useCallback((status: SetupGuideAIStatus) => {
    setAIStatus(status);
  }, []);
  const nativePlatform = getNativePlatform();
  const aiEnabled = aiSettings.ai.enabled;
  const canFinish = canFinishSetupGuideAI(aiEnabled, aiStatus);
  const statusMessage = aiEnabled
    ? aiStatus.busy
      ? "AI 配置正在处理中，请稍候。"
      : aiStatus.dirty
        ? "AI 配置有未保存的修改，请保存后再完成。"
        : !aiStatus.ready
          ? "请完成并保存 AI 配置后再完成引导。"
          : ""
    : "";

  useLayoutEffect(() => {
    headingRef.current?.focus();
    if (controlsRef.current) controlsRef.current.scrollTop = 0;
  }, [step]);

  const closeGuide = () => {
    useSettings.setState({ setupGuideSeen: true, setupGuideOpen: false });
  };

  const moveToStep = (nextStep: SetupStep) => {
    if (step === 2 && aiStatus.busy) return;
    if (nextStep === 2) setHasVisitedAI(true);
    setStep(nextStep);
  };

  const skipAI = () => closeGuide();

  return (
    <main
      className="setup-guide"
      data-native-platform={nativePlatform}
      aria-label="设置引导"
    >
      <div className="setup-guide-windowbar">
        {nativePlatform === "win" && <WinWindowControls />}
      </div>

      <header className="setup-guide-header">
        <ol className="setup-guide-steps" aria-label="设置步骤">
          {STEPS.map((item, index) => {
            const active = index === step;
            const complete = index < step;
            return (
              <li
                key={item.label}
                aria-current={active ? "step" : undefined}
                data-active={active || undefined}
                data-complete={complete || undefined}
              >
                <span className="setup-guide-step-marker" aria-hidden="true">
                  {complete ? <LucideIcons.Check size={14} /> : index + 1}
                </span>
                <span>{item.label}</span>
              </li>
            );
          })}
        </ol>
        <div className="setup-guide-heading">
          <p className="text-xs text-muted-foreground">第 {step + 1} 步，共 3 步</p>
          <h1 id="setup-guide-title" ref={headingRef} tabIndex={-1}>
            {STEPS[step].title}
          </h1>
        </div>
      </header>

      <div className="setup-guide-content">
        <section className="setup-guide-preview" aria-label="外观即时预览">
          <AppearanceEditorPreview
            sidebarFontSize={appearance.sidebarFontSize}
            editorFontSize={appearance.editorFontSize}
            editorLineHeight={appearance.editorLineHeight}
            uiFontSize={appearance.uiFontSize}
            showDemoEnglish={false}
          />
        </section>

        <section
          ref={controlsRef}
          className="setup-guide-controls"
          aria-labelledby="setup-guide-title"
        >
          <div
            className="setup-guide-control-step"
            hidden={step !== 0}
            inert={step !== 0 ? true : undefined}
            aria-hidden={step !== 0}
          >
            <SettingsAppearance
              {...appearance}
              section="appearance"
              showPreview={false}
            />
          </div>
          <div
            className="setup-guide-control-step"
            hidden={step !== 1}
            inert={step !== 1 ? true : undefined}
            aria-hidden={step !== 1}
          >
            <SettingsAppearance
              {...appearance}
              section="reading"
              showPreview={false}
            />
          </div>
          {hasVisitedAI && (
            <div
              className="setup-guide-control-step setup-guide-ai-settings"
              hidden={step !== 2}
              inert={step !== 2 ? true : undefined}
              aria-hidden={step !== 2}
            >
              <div className="settings-groups">
                <div>
                  <SettingsAI
                    mode="onboarding"
                    onSetupStateChange={onAISetupStateChange}
                    ai={aiSettings.ai}
                    enabled={aiEnabled}
                    setEnabled={aiSettings.setAIEnabled}
                    setReadGlobalPrompt={aiSettings.setAIReadGlobalPrompt}
                    setReadLocalSkills={aiSettings.setAIReadLocalSkills}
                    selectedModelId={aiSettings.ai.selectedModelId}
                    setSelectedModelId={aiSettings.setAISelectedModelId}
                    saveCustomConfig={aiSettings.saveAICustomConfig}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="setup-guide-footer">
        {step < 2 && (
          <Button type="button" variant="ghost" onClick={closeGuide}>
            退出引导
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => moveToStep(step === 0 ? 0 : (step - 1) as SetupStep)}
          disabled={step === 0 || (step === 2 && aiStatus.busy)}
        >
          上一步
        </Button>
        <div className="setup-guide-footer-actions">
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => moveToStep((step + 1) as SetupStep)}
            >
              下一步
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={skipAI}>
                跳过 AI
              </Button>
              <Button
                type="button"
                onClick={closeGuide}
                disabled={!canFinish}
              >
                完成设置
              </Button>
            </>
          )}
        </div>
        {step === 2 && statusMessage && (
          <p className="setup-guide-status" role="status" aria-live="polite">
            {statusMessage}
          </p>
        )}
      </footer>
    </main>
  );
}
