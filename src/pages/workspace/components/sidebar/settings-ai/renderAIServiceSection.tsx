import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
} from "@/lib/ai-provider";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import type { useAIModelRefresh } from "./useAIModelRefresh";
import { SETTINGS_OPTION_ROW_CLASS, ProviderIconTile } from "./shared";

export function renderAIServiceSection(
  context: ReturnType<typeof useAIModelRefresh>,
) {
  const {
    visible,
    isOnboarding,
    providerId,
    customBaseURL,
    setCustomBaseURL,
    apiKeyDraft,
    setApiKeyDraft,
    savingCustomConfig,
    setCustomSaveError,
    apiKeyVisible,
    setApiKeyVisible,
    testingConnection,
    cancelModelRefresh,
    cancelConnectionTest,
    selectedProvider,
    allowCustomBaseURL,
    activeProtocol,
    saveButtonReason,
    handleSaveCustomConfig,
    handleProviderChange,
  } = context;
  return (
    <SettingsSectionCard
      className={isOnboarding ? "p-4" : undefined}
      title={
        <span className="flex items-center gap-2">
          <GooseIcons.Bot
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          AI 服务
        </span>
      }
      description="选择模型供应商并填写对应 API Key。"
    >
      <div className="space-y-3">
        <div className="space-y-3">
          <div
            className={cn(
              "settings-ai-pick-row flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <ProviderIconTile providerId={providerId} />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  供应商
                </Label>
                <p className="text-xs text-muted-foreground">
                  {selectedProvider.description}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingCustomConfig || testingConnection}
                  className="min-w-[200px] justify-between rounded-[10px] px-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProviderIconTile providerId={providerId} size="sm" />
                    <span className="truncate">{selectedProvider.label}</span>
                  </span>
                  <GooseIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[288px] p-1.5">
                {AI_PROVIDER_PRESETS.map((option) => {
                  const selected = option.id === providerId;
                  return (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => handleProviderChange(option.id)}
                      className={cn(
                        "cursor-pointer gap-2.5 rounded-[10px] px-2 py-2",
                        selected &&
                          "bg-[var(--goose-interactive-selected)] text-foreground",
                      )}
                    >
                      <ProviderIconTile providerId={option.id} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-5 text-foreground">
                          {option.label}
                        </div>
                        <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                      <GooseIcons.Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-foreground",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                        strokeWidth={2}
                        aria-hidden={!selected}
                      />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {allowCustomBaseURL ? (
            <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
              <div className="flex items-center gap-3">
                <GooseIcons.Globe
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <Label
                  htmlFor="custom-ai-base-url"
                  className="text-sm font-medium text-foreground"
                >
                  Base URL
                </Label>
              </div>
              <Input
                id="custom-ai-base-url"
                value={customBaseURL}
                onChange={(event) => {
                  if (isOnboarding) {
                    cancelModelRefresh();
                    cancelConnectionTest();
                  }
                  setCustomSaveError(null);
                  setCustomBaseURL(event.target.value);
                }}
                placeholder={
                  activeProtocol === "claude"
                    ? DEFAULT_CLAUDE_BASE_URL
                    : DEFAULT_OPENAI_BASE_URL
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : null}

          <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
            <div className="flex items-center gap-3">
              <GooseIcons.KeyRound
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label
                htmlFor="custom-ai-api-key"
                className="text-sm font-medium text-foreground"
              >
                API Key
              </Label>
            </div>
            <div className="relative">
              <Input
                id="custom-ai-api-key"
                type={apiKeyVisible ? "text" : "password"}
                value={apiKeyDraft}
                onChange={(event) => {
                  if (isOnboarding) {
                    cancelModelRefresh();
                    cancelConnectionTest();
                  }
                  setCustomSaveError(null);
                  setApiKeyDraft(event.target.value);
                }}
                placeholder="输入 API Key（保存后自动获取可用模型）"
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] hover:bg-[var(--goose-interactive-hover)]"
                onClick={() => setApiKeyVisible((visible) => !visible)}
                aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                aria-pressed={apiKeyVisible}
              >
                {apiKeyVisible ? (
                  <GooseIcons.EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <GooseIcons.Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <GooseIcons.Download
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  保存配置
                </Label>
                <p className="text-xs text-muted-foreground">
                  {allowCustomBaseURL
                    ? "保存 Base URL 与 API Key，并自动获取可用模型列表。"
                    : "保存连接凭据并自动获取可用模型列表。"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TooltipProvider delayDuration={600}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        size="sm"
                        disabled={
                          Boolean(saveButtonReason) || testingConnection
                        }
                        onClick={() => {
                          void handleSaveCustomConfig();
                        }}
                        className={cn(
                          Boolean(saveButtonReason) && "cursor-not-allowed",
                        )}
                      >
                        {!savingCustomConfig && (
                          <GooseIcons.Save className="h-4 w-4" />
                        )}
                        {savingCustomConfig
                          ? "获取模型中…"
                          : isOnboarding
                            ? "保存并获取模型"
                            : "保存"}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {saveButtonReason ? (
                    <TooltipContent side="left">
                      {saveButtonReason}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
              {isOnboarding && savingCustomConfig ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelModelRefresh}
                >
                  取消获取
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
