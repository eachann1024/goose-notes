import type { CodeStyle } from "@/stores/useSettings";

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
    value: "vivid",
    label: "Vivid",
    description: "高对比度，色彩鲜艳 (Dracula)",
  },
  {
    value: "night",
    label: "Night",
    description: "赛博朋克风格 (Tokyo Night)",
  },
];

const defaultLabels = { default: "默认", serif: "衬线体", mono: "等宽体" };
const defaultFonts = {
  default: "DM Sans",
  serif: "仓耳今楷",
  mono: "DM Mono",
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">外观</h3>
        <p className="text-sm text-muted-foreground">
          自定义界面的外观和感觉。
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="dark-mode">深色模式</Label>
          <div className="flex items-center gap-2 border rounded-full p-1 bg-muted">
            <Button
              size="icon"
              variant="ghost"
              className={`h-6 w-6 rounded-full ${theme === "light" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setTheme("light")}
            >
              <LucideIcons.Sun className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`h-6 w-6 rounded-full ${theme === "dark" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <LucideIcons.Moon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`h-6 w-6 rounded-full ${theme === "system" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setTheme("system")}
            >
              <LucideIcons.Laptop className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>界面字体大小</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              调整整体界面的文字大小
            </p>
          </div>
          <div className="flex items-center gap-2 border rounded-full p-1 bg-muted">
            <Button
              size="sm"
              variant="ghost"
              className={`h-6 px-2 rounded-full text-xs ${uiFontSize === "small" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setUIFontSize("small")}
            >
              缩小
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-6 px-2 rounded-full text-xs ${uiFontSize === "normal" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setUIFontSize("normal")}
            >
              标准
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-6 px-2 rounded-full text-xs ${uiFontSize === "large" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setUIFontSize("large")}
            >
              放大
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">主题与代码风格</h4>
          <p className="text-xs text-muted-foreground mb-4">
            选择代码块的视觉风格（自动适配深浅模式）
          </p>

          <div className="grid grid-cols-1 gap-2">
            {codeStyles.map((t) => (
              <button
                key={t.value}
                onClick={() => setCodeStyle(t.value)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                  "hover:bg-accent hover:border-accent",
                  codeStyle === t.value && "border-primary bg-accent/50",
                )}
              >
                <LucideIcons.Code2 className="h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.description}
                  </div>
                </div>
                {codeStyle === t.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-1">自定义字体</h4>
          <p className="text-xs text-muted-foreground mb-4">
            留空使用默认值，字体名需与系统已安装字体一致，多个字体名用逗号分隔
          </p>

          <div className="space-y-4">
            {(["default", "serif", "mono"] as const).map((type) => (
              <div
                key={type}
                className="grid grid-cols-[80px_1fr_100px] gap-3 items-center"
              >
                <div className="flex items-center gap-1">
                  <Input
                    value={customFonts[type].label || ""}
                    onChange={(e) => setCustomLabel(type, e.target.value || null)}
                    placeholder={defaultLabels[type]}
                    className="h-8 text-sm px-2"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={customFonts[type].font || ""}
                    onChange={(e) => setCustomFont(type, e.target.value || null)}
                    placeholder="例：PingFang SC"
                    className="h-8 text-sm min-w-[200px]"
                  />
                </div>
                <div
                  className="text-center text-2xl h-8 flex items-center justify-center"
                  style={{
                    fontFamily: customFonts[type].font || getFontPreview(type),
                  }}
                >
                  Ag
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
