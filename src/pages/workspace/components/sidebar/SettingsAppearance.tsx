import { useSettings } from "@/stores/useSettings";
import {
  useEffect,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { AccentColor } from "@/stores/useSettings";
import {
  SIDEBAR_FONT_SIZE_MAX,
  SIDEBAR_FONT_SIZE_MIN,
} from "@/stores/useSettings";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { DEFAULT_FONT_NAMES, isLocalFontAvailable, normalizeLocalFontName } from "@/lib/fontLoader";
import { ReadingPreferences } from "../ReadingPreferences";
import { AppearanceEditorPreview } from "./AppearanceEditorPreview";

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
  uiFontSize: "small" | "normal";
  setUIFontSize: (size: "small" | "normal") => void;
  sidebarFontSize: number;
  increaseSidebarFontSize: () => void;
  decreaseSidebarFontSize: () => void;
  editorFontSize: number;
  increaseEditorFontSize: () => void;
  decreaseEditorFontSize: () => void;
}

type AccentOption = {
  value: AccentColor;
  label: string;
  previewLight: string;
  previewDark: string;
  lightSurface: string;
  lightForeground: string;
  darkSurface: string;
  darkForeground: string;
};

const accentOptions: AccentOption[] = [
  {
    value: "mono",
    label: "黑白",
    previewLight: "#171717",
    previewDark: "#f5f5f5",
    lightSurface: "#c4c4c4",
    lightForeground: "#171717",
    darkSurface: "rgba(255, 255, 255, 0.16)",
    darkForeground: "#f5f5f5",
  },
  {
    value: "iris",
    label: "鸢尾",
    previewLight: "#6366f1",
    previewDark: "#a5b4fc",
    lightSurface: "#e0e7ff",
    lightForeground: "#4f46e5",
    darkSurface: "rgba(99, 102, 241, 0.2)",
    darkForeground: "#a5b4fc",
  },
  {
    value: "ocean",
    label: "海蓝",
    previewLight: "#3b82f6",
    previewDark: "#93c5fd",
    lightSurface: "#dbeafe",
    lightForeground: "#2563eb",
    darkSurface: "rgba(59, 130, 246, 0.2)",
    darkForeground: "#93c5fd",
  },
  {
    value: "pine",
    label: "松绿",
    previewLight: "#15803d",
    previewDark: "#86efac",
    lightSurface: "#dcfce7",
    lightForeground: "#15803d",
    darkSurface: "rgba(34, 197, 94, 0.2)",
    darkForeground: "#86efac",
  },
  {
    value: "amber",
    label: "琥珀",
    previewLight: "#93702c",
    previewDark: "#fbbf24",
    lightSurface: "#f5e8cb",
    lightForeground: "#93702c",
    darkSurface: "rgba(245, 158, 11, 0.2)",
    darkForeground: "#fbbf24",
  },
  {
    value: "coral",
    label: "朱砂",
    previewLight: "#c2410c",
    previewDark: "#fdba74",
    lightSurface: "#ffedd5",
    lightForeground: "#c2410c",
    darkSurface: "rgba(249, 115, 22, 0.2)",
    darkForeground: "#fdba74",
  },
  {
    value: "rose",
    label: "莓红",
    previewLight: "#be123c",
    previewDark: "#fda4af",
    lightSurface: "#ffe4e6",
    lightForeground: "#be123c",
    darkSurface: "rgba(244, 63, 94, 0.2)",
    darkForeground: "#fda4af",
  },
  {
    value: "grape",
    label: "葡萄",
    previewLight: "#7e22ce",
    previewDark: "#d8b4fe",
    lightSurface: "#f3e8ff",
    lightForeground: "#7e22ce",
    darkSurface: "rgba(168, 85, 247, 0.2)",
    darkForeground: "#d8b4fe",
  },
];

type AccentOptionStyle = CSSProperties & {
  "--goose-accent-option-light-surface": string;
  "--goose-accent-option-light-fg": string;
  "--goose-accent-option-dark-surface": string;
  "--goose-accent-option-dark-fg": string;
};

const defaultLabels = { default: "默认", serif: "衬线体", mono: "等宽体" };
const APPEARANCE_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

function LocalFontInput({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const fontValue = draft ?? value;
  const [available, setAvailable] = useState(true);
  const unavailable = Boolean(fontValue.trim()) && !available;
  const commit = () => {
    const font = fontValue.trim();
    if (font && !normalizeLocalFontName(font)) {
      setAvailable(false);
      return;
    }
    if (font !== value) onChange(font);
    setDraft(null);
  };
  useEffect(() => {
    if (!fontValue.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void isLocalFontAvailable(fontValue.trim()).then((found) => {
        if (!cancelled) setAvailable(found);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fontValue]);
  return (
    <>
      <Input
        id={id}
        value={fontValue}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        maxLength={80}
        aria-invalid={unavailable}
        aria-describedby={unavailable ? `${id}-warning` : undefined}
        className="min-w-0 bg-background"
      />
      {unavailable && (
        <p
          id={`${id}-warning`}
          role="status"
          className="text-xs text-destructive"
        >
          未找到本机字体，当前显示回退字体
        </p>
      )}
    </>
  );
}

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
      <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          aria-label={`减小${label}`}
          disabled={value <= min}
          onClick={onDecrease}
        >
          <LucideIcons.Minus className="h-3.5 w-3.5" />
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
          className="h-7 w-7 rounded-full"
          aria-label={`增大${label}`}
          disabled={value >= max}
          onClick={onIncrease}
        >
          <LucideIcons.Plus className="h-3.5 w-3.5" />
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

  return (
    <div className="settings-appearance-layout">
      <AppearanceEditorPreview
        sidebarFontSize={sidebarFontSize}
        editorFontSize={editorFontSize}
        editorLineHeight={editorLineHeight}
        uiFontSize={uiFontSize}
      />
      <div className="settings-appearance-options min-w-0 space-y-8">
        <SettingsSectionCard title="主题" className="border border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LucideIcons.SunMoon
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label>主题模式</Label>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
              <TooltipProvider delayDuration={600}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="跟随系统"
                      aria-pressed={theme === "system"}
                      className={cn(
                        "h-7 w-7 rounded-full transition-all duration-200",
                        theme !== "system" && "text-foreground",
                        theme === "system" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("system")}
                    >
                      <LucideIcons.Laptop className="h-4 w-4" />
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
                        "h-7 w-7 rounded-full transition-all duration-200",
                        theme !== "light" && "text-foreground",
                        theme === "light" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("light")}
                    >
                      <LucideIcons.Sun className="h-4 w-4" />
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
                        "h-7 w-7 rounded-full transition-all duration-200",
                        theme !== "dark" && "text-foreground",
                        theme === "dark" &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                      )}
                      onClick={() => setTheme("dark")}
                    >
                      <LucideIcons.Moon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">深色模式</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className={`p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}>
            <div className="mb-3 flex items-start gap-3">
              <LucideIcons.Palette
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div
                id="appearance-accent-color-label"
                className="text-sm font-medium text-foreground"
              >
                强调色
              </div>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="appearance-accent-color-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {accentOptions.map((option, index) => {
                const selected = accentColor === option.value;
                const style: AccentOptionStyle = {
                  "--goose-accent-option-light-surface": option.lightSurface,
                  "--goose-accent-option-light-fg": option.lightForeground,
                  "--goose-accent-option-dark-surface": option.darkSurface,
                  "--goose-accent-option-dark-fg": option.darkForeground,
                };

                return (
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
                    className="goose-accent-option flex h-11 min-w-0 items-center gap-2 rounded-[10px] px-2.5 text-left text-xs font-medium text-foreground transition-[background-color,color,box-shadow,transform]"
                  >
                    <span
                      aria-hidden="true"
                      className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]"
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
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <LucideIcons.Check
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsSectionCard>
        <SettingsSectionCard
          title="字体与阅读"
          description="输入字体后按 Enter 或移开焦点应用；留空使用默认字体。"
          className="border border-border/60"
        >
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
            正文可在页面中选择默认、衬线或等宽；下面可自定义这三组字体的字形。
          </p>
          <div className="space-y-4">
            {(["default", "serif", "mono"] as const).map((type) => (
              <div
                key={type}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 rounded-xl bg-[hsl(var(--goose-selected-bg)/0.4)] p-2"
              >
                <Label>{defaultLabels[type]}</Label>
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
          <div className="space-y-3 border-t border-border/60 pt-4">
            <FontSizeStepper
              label="侧栏字体大小"
              description="只影响左侧栏的页面树、分区标题和笔记本名称。"
              icon={
                <LucideIcons.PanelLeft
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

            <div
              className={`flex items-center justify-between gap-4 p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <LucideIcons.AppWindow
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <Label>界面缩放</Label>
                </div>
                <p className="mt-1 pl-7 text-xs text-muted-foreground">
                  调整标题栏、设置等整体界面，不影响侧栏树和编辑器正文。
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--goose-selected-bg)/0.76)] p-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={uiFontSize === "small"}
                  className={cn(
                    "h-7 rounded-full px-3 text-xs transition-all duration-200",
                    uiFontSize === "small" &&
                      "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                  )}
                  onClick={() => setUIFontSize("small")}
                >
                  标准
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={uiFontSize === "normal"}
                  className={cn(
                    "h-7 rounded-full px-3 text-xs transition-all duration-200",
                    uiFontSize === "normal" &&
                      "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] shadow-sm",
                  )}
                  onClick={() => setUIFontSize("normal")}
                >
                  放大
                </Button>
              </div>
            </div>
          </div>
        </SettingsSectionCard>
        <EditorLayoutSettings />
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
                <LucideIcons.Check className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </SelectableCard>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
