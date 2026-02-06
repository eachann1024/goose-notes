import type { CodeStyle } from "@/stores/useSettings";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";

interface SettingsAppearanceProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  codeStyle: CodeStyle;
  setCodeStyle: (style: CodeStyle) => void;
  customFonts: Record<"default" | "serif" | "mono", { label: string | null; font: string | null }>;
  setCustomLabel: (type: "default" | "serif" | "mono", label: string | null) => void;
  setCustomFont: (type: "default" | "serif" | "mono", font: string | null) => void;
  uiFontSize: "small" | "normal" | "large";
  setUIFontSize: (size: "small" | "normal" | "large") => void;
}

const codeStyles: { value: CodeStyle; label: string; description: string }[] = [
  {
    value: "default",
    label: "Default",
    description: "Goose 默认风格，现代极简",
  },
  { value: "github", label: "GitHub", description: "经典的开发者风格" },
  {
    value: "modern",
    label: "Modern",
    description: "柔和的原子风格 (One Dark/Light)",
  },
  {
    value: "night",
    label: "Night",
    description: "赛博朋克风格 (Tokyo Night)",
  },
  {
    value: "nord",
    label: "Nord",
    description: "北境深色风格，低对比更柔和",
  },
  {
    value: "nord-light",
    label: "Nord Light",
    description: "北境浅色风格，清爽护眼",
  },
];

const defaultLabels = { default: "默认", serif: "衬线体", mono: "等宽体" };
const defaultFonts = {
  default: "DM Sans",
  serif: "仓耳今楷",
  mono: "DM Mono",
};
const fontPlaceholders = {
  default: "例：PingFang SC",
  serif: "例：Songti SC",
  mono: "例：JetBrains Mono",
};
const fontPreviewText = {
  default: "Goose Note 字体预览 Aa123",
  serif: "春风又绿江南岸 Aa123",
  mono: "const font = 'Aa123_鹅';",
};

export function SettingsAppearance({
  theme,
  setTheme,
  codeStyle,
  setCodeStyle,
  customFonts,
  setCustomLabel,
  setCustomFont,
  uiFontSize,
  setUIFontSize,
}: SettingsAppearanceProps) {
  const getFontPreview = (type: "default" | "serif" | "mono") =>
    customFonts[type].font || defaultFonts[type];
  const primaryModifier = getPrimaryModifierKeyDisplay({ style: "symbol" });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">外观</h3>
        <p className="text-sm text-muted-foreground">
          自定义界面的外观和感觉。
        </p>
      </div>

      <SettingsSectionCard
        title="主题设置"
        description="选择深浅模式，并调整界面字体大小。"
      >
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="dark-mode">深色模式</Label>
          <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 rounded-full transition-all duration-200",
                theme === "light" && "bg-background shadow-sm",
              )}
              onClick={() => setTheme("light")}
            >
              <LucideIcons.Sun className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 rounded-full transition-all duration-200",
                theme === "dark" && "bg-background shadow-sm",
              )}
              onClick={() => setTheme("dark")}
            >
              <LucideIcons.Moon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 rounded-full transition-all duration-200",
                theme === "system" && "bg-background shadow-sm",
              )}
              onClick={() => setTheme("system")}
            >
              <LucideIcons.Laptop className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] p-4">
          <div>
            <Label>界面字体大小</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              调整整体界面的文字大小
              <br />
              在界面按下 {primaryModifier} + / - / 0 可以临时调整字体大小
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 rounded-full px-3 text-xs transition-all duration-200",
                uiFontSize === "small" && "bg-background shadow-sm",
              )}
              onClick={() => setUIFontSize("small")}
            >
              缩小
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 rounded-full px-3 text-xs transition-all duration-200",
                uiFontSize === "normal" && "bg-background shadow-sm",
              )}
              onClick={() => setUIFontSize("normal")}
            >
              标准
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 rounded-full px-3 text-xs transition-all duration-200",
                uiFontSize === "large" && "bg-background shadow-sm",
              )}
              onClick={() => setUIFontSize("large")}
            >
              放大
            </Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="主题与代码风格"
        description="选择代码块视觉风格（自动适配深浅模式）。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {codeStyles.map((t) => (
            <SelectableCard
              key={t.value}
              selected={codeStyle === t.value}
              onClick={() => setCodeStyle(t.value)}
              className="flex items-center gap-3 rounded-[12px] border-0 bg-[hsl(var(--goose-selected-bg)/0.48)] px-3 py-3 hover:bg-[hsl(var(--goose-selected-bg)/0.76)]"
            >
              <LucideIcons.Code2 className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {t.description}
                </div>
              </div>
              {codeStyle === t.value ? (
                <div className="h-2 w-2 rounded-full bg-primary" />
              ) : null}
            </SelectableCard>
          ))}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="自定义字体"
        description="留空使用默认值，填写系统已安装字体名即可。"
      >
        <div className="space-y-4">
          {(["default", "serif", "mono"] as const).map((type) => (
            <div
              key={type}
              className="grid grid-cols-1 items-center gap-3 md:grid-cols-[88px_200px_minmax(0,1fr)]"
            >
              <div className="flex items-center gap-1">
                <Input
                  value={customFonts[type].label || ""}
                  onChange={(e) => setCustomLabel(type, e.target.value || null)}
                  placeholder={defaultLabels[type]}
                  className="h-8 px-2 text-sm"
                />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={customFonts[type].font || ""}
                  onChange={(e) => setCustomFont(type, e.target.value || null)}
                  placeholder={fontPlaceholders[type]}
                  className="h-8 w-[200px] text-sm"
                />
              </div>
              <div
                className="flex h-8 min-w-0 items-center overflow-hidden rounded-md bg-[hsl(var(--goose-selected-bg)/0.58)] px-3 text-sm md:text-base"
                style={{
                  fontFamily: customFonts[type].font || getFontPreview(type),
                }}
              >
                <span className="block min-w-0 truncate">{fontPreviewText[type]}</span>
              </div>
            </div>
          ))}
        </div>
      </SettingsSectionCard>
    </div>
  );
}
