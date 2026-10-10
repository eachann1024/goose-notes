import * as GooseIcons from "@/components/ui/icons";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import type { useAppearanceSettings } from "./useAppearanceSettings";
import {
  accentOptions,
  type AccentOptionStyle,
  APPEARANCE_OPTION_ROW_CLASS,
} from "./shared";

export function renderAppearanceTheme(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    accentRefs,
    focusedAccentIndex,
    setFocusedAccentIndex,
    handleAccentKeyDown,
  } = context;
  return (
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
                  aria-label="自动"
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
              <TooltipContent side="bottom">自动（跟随外观）</TooltipContent>
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
                <span className="flex min-w-0 flex-1 items-center gap-1 whitespace-nowrap">
                  {option.label}
                  {option.pro && (
                    <span className="shrink-0 rounded-control bg-[var(--goose-interactive-hover)] px-1 py-px text-[9px] font-semibold leading-none tracking-wide text-[var(--goose-interactive-hover-fg)]">
                      Pro
                    </span>
                  )}
                  {option.fullTheme && (
                    <GooseIcons.Pencil
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0"
                    />
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
                <TooltipContent
                  side="bottom"
                  className="max-w-64 whitespace-normal p-3 text-xs leading-relaxed"
                >
                  <p className="font-semibold">{option.label} · 完整主题</p>
                  <p className="mt-1 text-muted-foreground">
                    {option.fullTheme}
                  </p>
                  <p className="mt-2">
                    包含完整的纸面底色、侧栏、文字高亮与手绘铅笔质感图标。支持浅色与深色模式。
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    现有布局、字体与自定义图标均不受影响。
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              optionButton
            );
          })}
        </div>
      </div>
    </SettingsSectionCard>
  );
}
