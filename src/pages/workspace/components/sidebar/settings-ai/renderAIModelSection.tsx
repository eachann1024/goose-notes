import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
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
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import type { useAIModelRefresh } from "./useAIModelRefresh";
import { SETTINGS_OPTION_ROW_CLASS } from "./shared";

export function renderAIModelSection(
  context: ReturnType<typeof useAIModelRefresh>,
) {
  const {
    selectedModelId,
    isOnboarding,
    providerId,
    savingCustomConfig,
    customSaveError,
    testingConnection,
    modelSectionRef,
    customModels,
    currentModel,
    getConnectionForProvider,
    saveButtonReason,
    modelButtonDisabled,
    modelButtonReason,
    refreshCustomModels,
    handleModelChange,
  } = context;
  return (
    <div
      ref={modelSectionRef}
      id="ai-model-settings"
      tabIndex={-1}
      className="scroll-mt-6 rounded-[14px] outline-none "
    >
      <SettingsSectionCard
        className={isOnboarding ? "p-4" : undefined}
        title={
          <span className="flex items-center gap-2">
            <GooseIcons.Brain
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            AI 模型
          </span>
        }
        description={
          <span className="block">
            选择全局默认模型
            <span
              className="mt-1 block font-medium text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {savingCustomConfig
                ? "正在获取模型列表…"
                : customSaveError
                  ? `获取失败：${customSaveError}`
                  : customModels.length > 0
                    ? `已获取 ${customModels.length} 个${currentModel ? ` · ${currentModel.label}` : ""}`
                    : "尚未获取到模型"}
            </span>
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(saveButtonReason) || testingConnection}
            onClick={() => {
              void refreshCustomModels(
                getConnectionForProvider(providerId),
                "refresh",
              );
            }}
          >
            {savingCustomConfig ? (
              <GooseIcons.LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <GooseIcons.RefreshCw className="h-4 w-4" />
            )}
            {savingCustomConfig ? "获取中…" : "重新获取模型"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div
            className={cn(
              "settings-ai-pick-row flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <GooseIcons.Cpu
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  默认模型
                </Label>
              </div>
            </div>
            <TooltipProvider delayDuration={600}>
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
                            {currentModel?.label ??
                              modelButtonReason ??
                              "请选择模型"}
                          </span>
                          <GooseIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[280px]"
                        style={{
                          maxHeight: "min(360px, var(--available-height))",
                        }}
                      >
                        <DropdownMenuRadioGroup
                          value={selectedModelId ?? ""}
                          onValueChange={handleModelChange}
                        >
                          {customModels.map((model) => (
                            <DropdownMenuRadioItem
                              key={model.id}
                              value={model.id}
                              className="items-start gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  {model.label}
                                </div>
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
                  <TooltipContent side="left">
                    {modelButtonReason}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
