import * as GooseIcons from "@/components/ui/icons";
import { useSettings } from "@/stores/useSettings";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { UIFontSize } from "@/stores/settings/types";
import type { AccentColor } from "@/stores/useSettings";
import {
  SIDEBAR_FONT_SIZE_MAX,
  SIDEBAR_FONT_SIZE_MIN,
} from "@/stores/useSettings";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { DEFAULT_FONT_NAMES } from "@/lib/fontLoader";
import { ReadingPreferences } from "../ReadingPreferences";
import { AppearanceEditorPreview } from "./AppearanceEditorPreview";
import { DefaultFontSelect } from "../shared/DefaultFontSelect";
import { LocalFontInput } from "../shared/LocalFontInput";

interface SettingsAppearanceProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  accentColor: AccentColor;
  setAccentColor: (accentColor: AccentColor) => void;
  customFonts: Record<
    "default" | "serif" | "mono",
    { label: string | null; font: string | null }
  >;
  setCustomFont: (
    type: "default" | "serif" | "mono",
    font: string | null,
  ) => void;
  uiFontSize: UIFontSize;
  setUIFontSize: (size: UIFontSize) => void;
  sidebarFontSize: number;
  increaseSidebarFontSize: () => void;
  decreaseSidebarFontSize: () => void;
  editorFontSize: number;
  increaseEditorFontSize: () => void;
  decreaseEditorFontSize: () => void;
  section?: "all" | "appearance" | "reading";
  showPreview?: boolean;
}

type AccentOption = {
  value: AccentColor;
  label: string;
  previewLight: string;
  previewDark: string;
  lightSurface: string;
  darkSurface: string;
  fullTheme?: string;
};

const accentOptions: AccentOption[] = [
  {
    value: "mono",
    label: "叶脉",
    previewLight: "#756b42",
    previewDark: "#f5f5f5",
    lightSurface: "#eeebde",
    darkSurface: "rgba(255, 255, 255, 0.16)",
  },
  {
    value: "iris",
    label: "鸢尾",
    previewLight: "#6366f1",
    previewDark: "#a5b4fc",
    lightSurface: "#e0e7ff",
    darkSurface: "rgba(99, 102, 241, 0.2)",
  },
  {
    value: "ocean",
    label: "海蓝",
    previewLight: "#3b82f6",
    previewDark: "#93c5fd",
    lightSurface: "#dbeafe",
    darkSurface: "rgba(59, 130, 246, 0.2)",
  },
  {
    value: "pine",
    label: "松绿",
    previewLight: "#15803d",
    previewDark: "#86efac",
    lightSurface: "#dcfce7",
    darkSurface: "rgba(34, 197, 94, 0.2)",
  },
  {
    value: "amber",
    label: "浅秋",
    previewLight: "#e9dcb8",
    previewDark: "#c8b889",
    lightSurface: "#e9dfc7",
    darkSurface: "#39352a",
    fullTheme: "浅奶油黄与暖白纸面，像秋日里的一点淡淡日光。",
  },
  {
    value: "wheat",
    label: "麦笺",
    previewLight: "#d9d7bd",
    previewDark: "#b8b99a",
    lightSurface: "#e0ddc8",
    darkSurface: "#33382a",
    fullTheme: "灰麦黄与米白纸面，像铅笔画在一张安静的素描纸上。",
  },
  {
    value: "coral",
    label: "朱砂",
    previewLight: "#c2410c",
    previewDark: "#fdba74",
    lightSurface: "#ffedd5",
    darkSurface: "rgba(249, 115, 22, 0.2)",
  },
  {
    value: "rose",
    label: "莓红",
    previewLight: "#be123c",
    previewDark: "#fda4af",
    lightSurface: "#ffe4e6",
    darkSurface: "rgba(244, 63, 94, 0.2)",
  },
  {
    value: "grape",
    label: "葡萄",
    previewLight: "#7e22ce",
    previewDark: "#d8b4fe",
    lightSurface: "#f3e8ff",
    darkSurface: "rgba(168, 85, 247, 0.2)",
  },
];

type AccentOptionStyle = CSSProperties & {
  "--goose-accent-option-light-surface": string;
  "--goose-accent-option-light-fg": string;
  "--goose-accent-option-dark-surface": string;
  "--goose-accent-option-dark-fg": string;
};

const defaultLabels = { serif: "衬线体", mono: "等宽体" };
const APPEARANCE_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

function FontSizeStepper({
  label,
  description,
  icon,
  value,
  min,
  max,
  onDecrease,
  onIncrease,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}
    >
      <div>
        <div className="flex items-center gap-3">
          {icon}
          <Label>{label}</Label>
        </div>
        <p className="mt-1 pl-7 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-1 rounded-control bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-control"
          aria-label={`减小${label}`}
          disabled={value <= min}
          onClick={onDecrease}
        >
          <GooseIcons.Minus className="h-3.5 w-3.5" />
        </Button>
        <span
          className="min-w-8 text-center text-xs tabular-nums text-foreground"
          aria-live="polite"
        >
          {value}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-control"
          aria-label={`增大${label}`}
          disabled={value >= max}
          onClick={onIncrease}
        >
          <GooseIcons.Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsAppearance({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  customFonts,
  setCustomFont,
  uiFontSize,
  setUIFontSize,
  sidebarFontSize,
  increaseSidebarFontSize,
  decreaseSidebarFontSize,
  editorFontSize,
  section = "all",
  showPreview = true,
}: SettingsAppearanceProps) {
  const editorLineHeight = useSettings((s) => s.editorLineHeight);
  const setEditorLineHeight = useSettings((s) => s.setEditorLineHeight);
  const setEditorFontSize = useSettings((s) => s.setEditorFontSize);
  const uiFontFamily = useSettings((s) => s.uiFontFamily);
  const sidebarFontFamily = useSettings((s) => s.sidebarFontFamily);
  const setUIFontFamily = useSettings((s) => s.setUIFontFamily);
  const setSidebarFontFamily = useSettings((s) => s.setSidebarFontFamily);
  const accentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusedAccentIndex, setFocusedAccentIndex] = useState(() =>
    Math.max(
      0,
      accentOptions.findIndex((option) => option.value === accentColor),
    ),
  );

  const focusAccentOption = (index: number) => {
    const nextIndex = (index + accentOptions.length) % accentOptions.length;
    setFocusedAccentIndex(nextIndex);
    accentRefs.current[nextIndex]?.focus();
  };

  const handleAccentKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusAccentOption(index + 1);
      setAccentColor(accentOptions[(index + 1) % accentOptions.length].value);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAccentOption(index - 1);
      setAccentColor(
        accentOptions[(index - 1 + accentOptions.length) % accentOptions.length]
          .value,
      );
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusAccentOption(0);
      setAccentColor(accentOptions[0].value);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusAccentOption(accentOptions.length - 1);
      setAccentColor(accentOptions[accentOptions.length - 1].value);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setAccentColor(accentOptions[index].value);
    }
  };

  const interfaceFontSettings = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appearance-ui-font">界面字体</Label>
          <LocalFontInput
            id="appearance-ui-font"
            value={uiFontFamily ?? ""}
            onChange={setUIFontFamily}
            placeholder="系统默认"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="appearance-sidebar-font">侧栏字体</Label>
          <LocalFontInput
            id="appearance-sidebar-font"
            value={sidebarFontFamily ?? ""}
            onChange={setSidebarFontFamily}
            placeholder="系统默认"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        正文默认字体与首次引导共用；页面仍可单独切换默认、衬线或等宽字体。
      </p>
    </>
  );

  const defaultFontSettings = (
    <DefaultFontSelect
      id="appearance-default-font"
      value={customFonts.default.font}
      fontSize={editorFontSize}
      lineHeight={editorLineHeight}
      onChange={(font) => setCustomFont("default", font)}
      showPreview={section === "all"}
    />
  );

  const additionalFontSettings = (
    <div className="space-y-4">
      {(["serif", "mono"] as const).map((type) => (
        <div
          key={type}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 rounded-xl bg-[hsl(var(--goose-selected-bg)/0.4)] p-2"
        >
          <Label htmlFor={`appearance-${type}-font`}>{defaultLabels[type]}</Label>
          <div className="flex flex-1 items-center gap-2">
            <LocalFontInput
              id={`appearance-${type}-font`}
              label={`${defaultLabels[type]}字体名称`}
              value={customFonts[type].font || ""}
              onChange={(value) => setCustomFont(type, value || null)}
              placeholder={`默认：${DEFAULT_FONT_NAMES[type]}`}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const sidebarFontSizeSettings = (
    <FontSizeStepper
      label="侧栏字体大小"
      description="只影响左侧栏的页面树、分区标题和笔记本名称。"
      icon={
        <GooseIcons.PanelLeft
          className="h-4 w-4 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
      }
      value={sidebarFontSize}
      min={SIDEBAR_FONT_SIZE_MIN}
      max={SIDEBAR_FONT_SIZE_MAX}
      onDecrease={decreaseSidebarFontSize}
      onIncrease={increaseSidebarFontSize}
    />
  );

  const readingSettings = (
    <div className={`p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}>
      <ReadingPreferences
        showPreview={false}
        fontSize={editorFontSize}
        lineHeight={editorLineHeight}
        onFontSizeChange={setEditorFontSize}
        onLineHeightChange={setEditorLineHeight}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        代码块保留独立行高。
      </p>
    </div>
  );

  const uiFontSizeSettings = (
    <div
      className={`flex items-center justify-between gap-4 p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}
    >
      <div>
        <div className="flex items-center gap-3">
          <GooseIcons.AppWindow
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Label>界面缩放</Label>
        </div>
        <p className="mt-1 pl-7 text-xs text-muted-foreground">
          调整标题栏、设置等整体界面，不影响侧栏树和编辑器正文。
        </p>
      </div>
      <div
        role="group"
        aria-label="界面缩放"
        className="flex shrink-0 items-center gap-1 rounded-control bg-[hsl(var(--goose-selected-bg)/0.76)] p-1"
      >
        {([["small", "低"], ["normal", "中"], ["large", "高"]] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant="ghost"
            aria-pressed={uiFontSize === value}
            className={cn(
              "h-7 rounded-control px-3 text-xs transition-all duration-200",
              uiFontSize === value &&
                "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
            )}
            onClick={() => setUIFontSize(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="settings-appearance-layout"
      data-appearance-section={section}
    >
      {showPreview && (
        <AppearanceEditorPreview
          editorOnly
          sidebarFontSize={sidebarFontSize}
          editorFontSize={editorFontSize}
          editorLineHeight={editorLineHeight}
          uiFontSize={uiFontSize}
        />
      )}
      <div className="settings-appearance-options min-w-0 space-y-8">
        {section !== "reading" && (
          <SettingsSectionCard title="主题" className="border border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GooseIcons.SunMoon
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label>主题模式</Label>
            </div>
            <div className="flex items-center gap-1 rounded-control bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
              <TooltipProvider delayDuration={600}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="跟随系统"
                      aria-pressed={theme === "system"}
                      className={cn(
                        "h-7 w-7 rounded-control transition-all duration-200",
                        theme !== "system" && "text-foreground",
                        theme === "system" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("system")}
                    >
                      <GooseIcons.Laptop className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">跟随系统</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="浅色模式"
                      aria-pressed={theme === "light"}
                      className={cn(
                        "h-7 w-7 rounded-control transition-all duration-200",
                        theme !== "light" && "text-foreground",
                        theme === "light" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("light")}
                    >
                      <GooseIcons.Sun className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">浅色模式</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="深色模式"
                      aria-pressed={theme === "dark"}
                      className={cn(
                        "h-7 w-7 rounded-control transition-all duration-200",
                        theme !== "dark" && "text-foreground",
                        theme === "dark" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("dark")}
                    >
                      <GooseIcons.Moon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">深色模式</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className={`p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}>
            <div className="mb-3 flex items-start gap-3">
              <GooseIcons.Palette
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div
                id="appearance-accent-color-label"
                className="text-sm font-medium text-foreground"
              >
                配色与主题
              </div>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="appearance-accent-color-label"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2"
            >
              {accentOptions.map((option, index) => {
                const selected = accentColor === option.value;
                const style: AccentOptionStyle = {
                  "--goose-accent-option-light-surface": option.lightSurface,
                  "--goose-accent-option-light-fg": "var(--goose-text-primary)",
                  "--goose-accent-option-dark-surface": option.darkSurface,
                  "--goose-accent-option-dark-fg": "var(--goose-text-primary)",
                };

                const optionButton = (
                  <button
                    key={option.value}
                    ref={(node) => {
                      accentRefs.current[index] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    data-state={selected ? "checked" : "unchecked"}
                    tabIndex={focusedAccentIndex === index ? 0 : -1}
                    style={style}
                    onFocus={() => setFocusedAccentIndex(index)}
                    onKeyDown={(event) => handleAccentKeyDown(event, index)}
                    onClick={() => {
                      setFocusedAccentIndex(index);
                      setAccentColor(option.value);
                    }}
                    className="goose-accent-option flex h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-foreground transition-[background-color,color,box-shadow,transform]"
                  >
                    <span
                      aria-hidden="true"
                      className="relative h-5 w-5 shrink-0 overflow-hidden rounded-control shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]"
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-1/2"
                        style={{ backgroundColor: option.previewLight }}
                      />
                      <span
                        className="absolute inset-y-0 right-0 w-1/2"
                        style={{ backgroundColor: option.previewDark }}
                      />
                    </span>
                    <span className="flex flex-1 items-center gap-1 whitespace-nowrap">
                      {option.label}
                      {option.fullTheme && (
                        <GooseIcons.Pencil aria-hidden="true" className="h-3 w-3 shrink-0" />
                      )}
                    </span>
                    <GooseIcons.Check
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                );
                return option.fullTheme ? (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>{optionButton}</TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64 whitespace-normal p-3 text-xs leading-relaxed">
                      <p className="font-semibold">{option.label} · 完整主题</p>
                      <p className="mt-1 text-muted-foreground">{option.fullTheme}</p>
                      <p className="mt-2">更换：侧栏与纸面底色、菜单与 AI 面板、选中与文字高亮、功能图标的铅笔描边。支持浅色与深色。</p>
                      <p className="mt-1 text-muted-foreground">保留现有布局、字体与图标大小，以及自选的页面图标。</p>
                    </TooltipContent>
                  </Tooltip>
                ) : optionButton;
              })}
            </div>
          </div>
          </SettingsSectionCard>
        )}
        {section !== "appearance" && (
          <SettingsSectionCard
            title="字体与阅读"
            description={section === "all"
              ? "界面、侧栏与正文默认字体彼此独立；选择后保存，自定义字体按 Enter 或移开焦点应用。"
              : undefined}
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
                    {sidebarFontSizeSettings}
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
                  {sidebarFontSizeSettings}
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

function EditorLayoutSettings() {
  const layout = useSettings((state) => state.defaultPageLayout);
  return (
    <SettingsSectionCard
      title="编辑布局"
      description="未单独设置布局的笔记使用此项；单篇笔记可在右上角菜单覆盖。"
    >
      <div
        role="group"
        aria-label="默认布局"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {(
          [
            ["full", "全宽", "铺满可用编辑区域"],
            ["standard", "标准", "均衡留白，日常编辑"],
          ] as const
        ).map(([value, label, description]) => (
          <SelectableCard
            key={value}
            type="button"
            selected={layout === value}
            aria-pressed={layout === value}
            onClick={() => useSettings.setState({ defaultPageLayout: value })}
            className={cn(
              "flex flex-col gap-3 p-3",
              layout === value
                ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                : "bg-[hsl(var(--goose-selected-bg)/0.48)] hover:bg-[var(--goose-interactive-hover)] dark:bg-[hsl(var(--foreground)/0.08)]",
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-14 w-full gap-2 rounded-md border border-current/20 bg-background/50 p-2"
            >
              <span
                className={cn(
                  "flex flex-col gap-1.5",
                  value === "standard" ? "mx-auto w-2/3" : "flex-1",
                )}
              >
                <span className="h-1 w-1/2 rounded bg-current/30" />
                <span className="h-1 w-full rounded bg-current/20" />
                <span className="h-1 w-4/5 rounded bg-current/20" />
              </span>
            </span>
            <span className="flex w-full items-center justify-between text-sm font-medium">
              {label}
              {layout === value && (
                <GooseIcons.Check className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </SelectableCard>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
