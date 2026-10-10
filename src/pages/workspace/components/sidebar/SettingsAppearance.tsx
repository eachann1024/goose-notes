import { renderAppearanceTheme } from "./appearance-settings/renderAppearanceTheme";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { AppearanceEditorPreview } from "./AppearanceEditorPreview";
import {
  type SettingsAppearanceProps,
  EditorLayoutSettings,
} from "./appearance-settings/shared";
import { useAppearanceSettings } from "./appearance-settings/useAppearanceSettings";
import { renderInterfaceFontSettings } from "./appearance-settings/renderInterfaceFontSettings";
import { renderDefaultFontSettings } from "./appearance-settings/renderDefaultFontSettings";
import { renderAdditionalFontSettings } from "./appearance-settings/renderAdditionalFontSettings";
import { renderReadingSettings } from "./appearance-settings/renderReadingSettings";
import { renderUIFontSizeSettings } from "./appearance-settings/renderUIFontSizeSettings";

export function SettingsAppearance(props: SettingsAppearanceProps) {
  const appearanceSettingsContext = useAppearanceSettings(props);
  const context = appearanceSettingsContext;
  const {
    uiFontSize,
    editorFontSize,
    section,
    showPreview,
    appearanceLayoutRef,
    scaleDragLayout,
    editorLineHeight,
  } = context;

  const interfaceFontSettings = renderInterfaceFontSettings(context);

  const defaultFontSettings = renderDefaultFontSettings(context);

  const additionalFontSettings = renderAdditionalFontSettings(context);

  const readingSettings = renderReadingSettings(context);

  const uiFontSizeSettings = renderUIFontSizeSettings(context);

  return (
    <div
      ref={appearanceLayoutRef}
      className="settings-appearance-layout"
      data-appearance-section={section}
      data-scale-drag-layout={scaleDragLayout ?? undefined}
    >
      {showPreview && (
        <AppearanceEditorPreview
          editorOnly
          editorFontSize={editorFontSize}
          editorLineHeight={editorLineHeight}
          uiFontSize={uiFontSize}
        />
      )}
      <div className="settings-appearance-options min-w-0 space-y-8">
        {section !== "reading" && renderAppearanceTheme(context)}
        {section !== "appearance" && (
          <SettingsSectionCard
            title="字体与阅读"
            description={
              section === "all"
                ? "可独立设置界面、侧栏与正文字体；支持键盘方向键即时预览。"
                : undefined
            }
            className="border border-border/60"
          >
            {section === "reading" ? (
              <>
                {defaultFontSettings}
                {readingSettings}
                <details className="setup-guide-advanced-settings border-t border-border/60 pt-3">
                  <summary className="cursor-pointer rounded-md py-2 text-sm font-medium text-foreground">
                    界面与侧栏调节
                  </summary>
                  <div className="mt-4 space-y-4">
                    {interfaceFontSettings}
                    {additionalFontSettings}
                    {uiFontSizeSettings}
                  </div>
                </details>
              </>
            ) : (
              <>
                {interfaceFontSettings}
                {defaultFontSettings}
                {additionalFontSettings}
                <div className="space-y-3 border-t border-border/60 pt-4">
                  {readingSettings}
                  {uiFontSizeSettings}
                </div>
              </>
            )}
          </SettingsSectionCard>
        )}
        {section !== "reading" && <EditorLayoutSettings />}
      </div>
    </div>
  );
}
