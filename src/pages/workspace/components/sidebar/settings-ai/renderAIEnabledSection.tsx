import * as GooseIcons from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import type { useAIModelRefresh } from "./useAIModelRefresh";
import { SETTINGS_OPTION_ROW_CLASS } from "./shared";

export function renderAIEnabledSection(
  context: ReturnType<typeof useAIModelRefresh>,
) {
  const { enabled, setEnabled, isOnboarding } = context;
  return (
    <SettingsSectionCard
      className={isOnboarding ? "p-4" : undefined}
      contentClassName={isOnboarding ? "space-y-3" : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-4 p-4",
          SETTINGS_OPTION_ROW_CLASS,
        )}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <GooseIcons.Sparkles className="h-4 w-4 text-current" />
            <Label
              htmlFor="ai-enabled"
              className="cursor-pointer text-sm font-medium text-foreground"
            >
              启用 AI 助手
            </Label>
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            关闭后隐藏所有 AI 功能入口，并终止正在生成的任务。
          </div>
        </div>
        <Switch
          id="ai-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    </SettingsSectionCard>
  );
}
