import * as GooseIcons from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import type { useAIModelRefresh } from "./useAIModelRefresh";
import { SETTINGS_OPTION_ROW_CLASS } from "./shared";

export function renderAIContextSection(
  context: ReturnType<typeof useAIModelRefresh>,
) {
  const { ai, setReadGlobalPrompt, setReadLocalSkills, isOnboarding } = context;
  return (
    <SettingsSectionCard
      className={isOnboarding ? "p-4" : undefined}
      title={
        <span className="flex items-center gap-2">
          <GooseIcons.FolderCog
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          本地上下文与技能扩展
        </span>
      }
      description="开启后，全局提示词与本地技能 (Skills) 将注入 AI 对话上下文。"
    >
      <div className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            SETTINGS_OPTION_ROW_CLASS,
          )}
        >
          <div className="space-y-1">
            <Label
              htmlFor="ai-read-global-prompt"
              className="cursor-pointer text-sm font-medium text-foreground"
            >
              读取全局提示词
            </Label>
            <div className="text-xs leading-5 text-muted-foreground">
              作为预设指令 (System Prompt) 注入对话
            </div>
          </div>
          <Switch
            id="ai-read-global-prompt"
            checked={ai.readGlobalPrompt}
            onCheckedChange={setReadGlobalPrompt}
          />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            SETTINGS_OPTION_ROW_CLASS,
          )}
        >
          <div className="space-y-1">
            <Label
              htmlFor="ai-read-local-skills"
              className="cursor-pointer text-sm font-medium text-foreground"
            >
              读取本地技能 (Skills)
            </Label>
            <div className="text-xs leading-5 text-muted-foreground">
              支持在对话框中输入 / 快速调用
            </div>
          </div>
          <Switch
            id="ai-read-local-skills"
            checked={ai.readLocalSkills}
            onCheckedChange={setReadLocalSkills}
          />
        </div>
      </div>
    </SettingsSectionCard>
  );
}
