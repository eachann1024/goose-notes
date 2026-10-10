import * as GooseIcons from "@/components/ui/icons";
import { useSettings } from "@/stores/useSettings";
import { type CSSProperties } from "react";
import type { UIFontSize } from "@/stores/settings/types";
import type { AccentColor } from "@/stores/useSettings";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";

export interface SettingsAppearanceProps {
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
  editorFontSize: number;
  increaseEditorFontSize: () => void;
  decreaseEditorFontSize: () => void;
  section?: "all" | "appearance" | "reading";
  showPreview?: boolean;
}

export type AccentOption = {
  value: AccentColor;
  label: string;
  previewLight: string;
  previewDark: string;
  lightSurface: string;
  darkSurface: string;
  fullTheme?: string;
  pro?: boolean;
};

export const accentOptions: AccentOption[] = [
  {
    value: "ocean",
    label: "海蓝",
    previewLight: "#3b82f6",
    previewDark: "#93c5fd",
    lightSurface: "#dbeafe",
    darkSurface: "rgba(59, 130, 246, 0.2)",
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
    value: "pine",
    label: "松绿",
    previewLight: "#15803d",
    previewDark: "#86efac",
    lightSurface: "#dcfce7",
    darkSurface: "rgba(34, 197, 94, 0.2)",
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
  {
    value: "mono",
    label: "叶脉",
    previewLight: "#756b42",
    previewDark: "#f5f5f5",
    lightSurface: "#eeebde",
    darkSurface: "rgba(255, 255, 255, 0.16)",
    pro: true,
  },
  {
    value: "amber",
    label: "浅秋",
    previewLight: "#e9dcb8",
    previewDark: "#c8b889",
    lightSurface: "#e9dfc7",
    darkSurface: "#39352a",
    fullTheme: "浅奶油黄与暖白纸面，像秋日里的一点淡淡日光。",
    pro: true,
  },
  {
    value: "wheat",
    label: "麦笺",
    previewLight: "#d9d7bd",
    previewDark: "#b8b99a",
    lightSurface: "#e0ddc8",
    darkSurface: "#33382a",
    fullTheme: "灰麦黄与米白纸面，像铅笔画在一张安静的素描纸上。",
    pro: true,
  },
];

export type AccentOptionStyle = CSSProperties & {
  "--goose-accent-option-light-surface": string;
  "--goose-accent-option-light-fg": string;
  "--goose-accent-option-dark-surface": string;
  "--goose-accent-option-dark-fg": string;
};

export const defaultLabels = { serif: "衬线体", mono: "等宽体" };

export const APPEARANCE_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export function EditorLayoutSettings() {
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
