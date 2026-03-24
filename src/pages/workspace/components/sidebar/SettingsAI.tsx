import { useEffect, useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import { getAvailableUToolsAiModels, isUToolsAiSupported, type UToolsAiModel } from "@/lib/utools-ai";

interface SettingsAIProps {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export function SettingsAI({
  enabled,
  setEnabled,
  selectedModelId,
  setSelectedModelId,
}: SettingsAIProps) {
  const [models, setModels] = useState<UToolsAiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const aiSupported = useMemo(() => isUToolsAiSupported(), []);

  useEffect(() => {
    let active = true;

    async function loadModels() {
      if (!enabled || !aiSupported) {
        setModels([]);
        setLoadError(aiSupported ? null : "当前 uTools 版本未提供 AI 能力");
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const nextModels = await getAvailableUToolsAiModels();
        if (!active) return;
        setModels(nextModels);
        if (nextModels.length === 0) {
          setLoadError("未读取到可用模型");
          return;
        }
        if (!selectedModelId || !nextModels.some((item) => item.id === selectedModelId)) {
          setSelectedModelId(nextModels[0].id);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "读取模型列表失败";
        setLoadError(message);
        setModels([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      active = false;
    };
  }, [aiSupported, enabled, selectedModelId, setSelectedModelId]);

  const selectedModel = models.find((item) => item.id === selectedModelId) ?? null;
  const modelButtonDisabled = !enabled || !aiSupported || loading || Boolean(loadError) || models.length === 0;
  const modelButtonReason = !enabled
    ? "先打开 AI 助手开关后才能选择模型"
    : !aiSupported
      ? "当前 uTools 版本未提供 AI 能力"
      : loading
        ? "模型列表读取中，请稍候"
        : loadError || (models.length === 0 ? "暂无可选模型" : null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">AI 助手</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          管理编辑器内的 AI 入口、模型选择和空格唤起行为。
        </p>
      </div>

      <SettingsSectionCard
        title="AI 开关"
        description="打开后，空白段落按空格会唤起 AI 工具栏；关闭后恢复为传统的 / 命令提示。"
      >
        <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
          <div className="space-y-1">
            <Label htmlFor="ai-enabled" className="cursor-pointer text-sm font-medium text-foreground">
              启用 AI 写作助手
            </Label>
            <p className="text-xs text-muted-foreground">
              可选值：开启 / 关闭。开启后会显示“空格唤起 AI”，关闭后不会显示也不会触发。副作用：打开后会请求 uTools AI 模型列表。可扩展用途：后续可在这里集中管理选区 AI、默认动作与提示词模板。
            </p>
          </div>
          <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="AI 模型"
        description="从 uTools 提供的可用模型中选择一个作为默认模型。"
        actions={
          enabled && aiSupported ? (
            <Button variant="secondary" size="sm" onClick={() => setSelectedModelId(null)}>
              刷新并重选
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">默认模型</Label>
              <p className="text-xs text-muted-foreground">
                作用：决定 AI 工具栏默认使用哪个模型。可选值：来自 uTools 的模型列表。副作用：不同模型响应速度和成本可能不同。可扩展用途：后续可以细分为“续写模型”和“总结模型”。
              </p>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={modelButtonDisabled}
                          className={cn(
                            "min-w-[220px] justify-between rounded-[10px]",
                            modelButtonDisabled && "cursor-not-allowed",
                          )}
                        >
                          <span className="truncate">
                            {loading
                              ? "正在读取模型..."
                              : selectedModel?.label ?? loadError ?? "请选择模型"}
                          </span>
                          <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[280px]">
                        <DropdownMenuRadioGroup
                          value={selectedModelId ?? ""}
                          onValueChange={(value) => setSelectedModelId(value)}
                        >
                          {models.map((model) => (
                            <DropdownMenuRadioItem key={model.id} value={model.id} className="items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">{model.label}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {model.description || model.id}
                                </div>
                              </div>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipTrigger>
                {modelButtonReason ? (
                  <TooltipContent side="left">{modelButtonReason}</TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={cn("rounded-[12px] p-4", SETTINGS_OPTION_ROW_CLASS)}>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LucideIcons.BadgeInfo className="h-4 w-4 text-muted-foreground" />
                当前状态
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {enabled
                  ? aiSupported
                    ? selectedModel
                      ? `已启用，当前默认模型为「${selectedModel.label}」。`
                      : loading
                        ? "已启用，正在读取模型列表。"
                        : "已启用，但还没有选中可用模型。"
                    : "已启用，但当前环境未提供 uTools AI。"
                  : "已关闭，编辑器将不会显示空格唤起 AI。"}
              </p>
            </div>
            <div className={cn("rounded-[12px] p-4", SETTINGS_OPTION_ROW_CLASS)}>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LucideIcons.Sparkles className="h-4 w-4 text-muted-foreground" />
                交互说明
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                AI 打开后，空白段落会显示“空格唤起 AI，/ 插入块...”；AI 关闭后，会恢复“输入 '/' 或 '、' 来输入指令...”。
              </p>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
