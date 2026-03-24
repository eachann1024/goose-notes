import { useEffect, useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { fetchCustomAIModels, getStoredAIModelOptions, type AIModelOption, type CustomAIProtocol } from "@/lib/ai-provider";
import { getAvailableUToolsAiModels, isUToolsAiSupported, type UToolsAiModel } from "@/lib/utools-ai";
import type { AISettings } from "@/stores/useSettings";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { cn } from "@/lib/utils";

interface SettingsAIProps {
  ai: AISettings;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  setCustomProviderEnabled: (enabled: boolean) => void;
  saveCustomConfig: (config: {
    protocol: CustomAIProtocol;
    baseURL: string;
    apiKey: string;
    modelOptions: AIModelOption[];
  }) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const CUSTOM_PROTOCOL_OPTIONS: Array<{
  id: CustomAIProtocol;
  label: string;
  description: string;
}> = [
  {
    id: "openai",
    label: "OpenAI 兼容协议",
    description: "支持自定义 baseURL 与 API Key",
  },
  {
    id: "claude",
    label: "Claude 协议",
    description: "使用 Anthropic 官方模型接口",
  },
];

const CUSTOM_AI_KEY_HINT = "请前往“设置 -> AI 助手 -> 自定义 AI”补充 API Key";

export function SettingsAI({
  ai,
  enabled,
  setEnabled,
  selectedModelId,
  setSelectedModelId,
  setCustomProviderEnabled,
  saveCustomConfig,
}: SettingsAIProps) {
  const [utoolsModels, setUToolsModels] = useState<UToolsAiModel[]>([]);
  const [loadingUToolsModels, setLoadingUToolsModels] = useState(false);
  const [utoolsLoadError, setUToolsLoadError] = useState<string | null>(null);
  const [customProtocol, setCustomProtocol] = useState<CustomAIProtocol>(ai.customProtocol);
  const [customBaseURL, setCustomBaseURL] = useState(ai.customBaseURL);
  const [customApiKey, setCustomApiKey] = useState(ai.customApiKey);
  const [savingCustomConfig, setSavingCustomConfig] = useState(false);
  const [customSaveError, setCustomSaveError] = useState<string | null>(null);

  const aiSupported = useMemo(() => isUToolsAiSupported(), []);
  const customModels = getStoredAIModelOptions(ai);
  const usingCustomProvider = ai.useCustomProvider;

  useEffect(() => {
    setCustomProtocol(ai.customProtocol);
  }, [ai.customProtocol]);

  useEffect(() => {
    setCustomBaseURL(ai.customBaseURL);
  }, [ai.customBaseURL]);

  useEffect(() => {
    setCustomApiKey(ai.customApiKey);
  }, [ai.customApiKey]);

  useEffect(() => {
    let active = true;

    async function loadUToolsModels() {
      if (!enabled || usingCustomProvider || !aiSupported) {
        setUToolsModels([]);
        setUToolsLoadError(aiSupported ? null : "当前 uTools 版本未提供 AI 能力");
        return;
      }

      setLoadingUToolsModels(true);
      setUToolsLoadError(null);

      try {
        const nextModels = await getAvailableUToolsAiModels();
        if (!active) return;

        setUToolsModels(nextModels);
        if (nextModels.length === 0) {
          setUToolsLoadError("未读取到可用模型");
          return;
        }

        if (!selectedModelId || !nextModels.some((item) => item.id === selectedModelId)) {
          setSelectedModelId(nextModels[0].id);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "读取模型列表失败";
        setUToolsLoadError(message);
        setUToolsModels([]);
      } finally {
        if (active) {
          setLoadingUToolsModels(false);
        }
      }
    }

    void loadUToolsModels();

    return () => {
      active = false;
    };
  }, [aiSupported, enabled, selectedModelId, setSelectedModelId, usingCustomProvider]);

  useEffect(() => {
    if (!usingCustomProvider || customModels.length === 0) {
      return;
    }

    if (!selectedModelId || !customModels.some((item) => item.id === selectedModelId)) {
      setSelectedModelId(customModels[0].id);
    }
  }, [customModels, selectedModelId, setSelectedModelId, usingCustomProvider]);

  const currentModels = usingCustomProvider ? customModels : utoolsModels;
  const currentModel = currentModels.find((item) => item.id === selectedModelId) ?? null;
  const selectedProtocol = CUSTOM_PROTOCOL_OPTIONS.find((item) => item.id === customProtocol) ?? CUSTOM_PROTOCOL_OPTIONS[0];

  const saveButtonReason = savingCustomConfig
    ? "正在保存并读取模型列表"
    : !customApiKey.trim()
      ? CUSTOM_AI_KEY_HINT
      : customProtocol === "openai" && !customBaseURL.trim()
        ? "请先填写 OpenAI 兼容接口地址"
        : null;

  const modelButtonDisabled = !enabled
    || (usingCustomProvider
      ? savingCustomConfig || customModels.length === 0
      : !aiSupported || loadingUToolsModels || Boolean(utoolsLoadError) || utoolsModels.length === 0);

  const modelButtonReason = !enabled
    ? "先打开 AI 助手开关后才能选择模型"
    : usingCustomProvider
      ? savingCustomConfig
        ? "模型列表读取中，请稍候"
        : customSaveError
          ? customSaveError
          : customModels.length === 0
            ? "请先填写并保存自定义 AI 配置"
            : null
      : !aiSupported
        ? "当前 uTools 版本未提供 AI 能力"
        : loadingUToolsModels
          ? "模型列表读取中，请稍候"
          : utoolsLoadError || (utoolsModels.length === 0 ? "暂无可选模型" : null);

  const handleSaveCustomConfig = async () => {
    if (saveButtonReason) {
      toast.error(saveButtonReason);
      return;
    }

    setSavingCustomConfig(true);
    setCustomSaveError(null);

    try {
      const modelOptions = await fetchCustomAIModels({
        protocol: customProtocol,
        baseURL: customBaseURL,
        apiKey: customApiKey,
      });

      saveCustomConfig({
        protocol: customProtocol,
        baseURL: customProtocol === "openai" ? customBaseURL : "",
        apiKey: customApiKey,
        modelOptions,
      });

      setSelectedModelId(modelOptions[0].id);
      toast.success("自定义 AI 已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存自定义 AI 失败";
      setCustomSaveError(message);
      toast.error(message);
    } finally {
      setSavingCustomConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">AI 助手</h3>
        <p className="mt-1 text-sm text-muted-foreground">管理 AI 入口、模型和空格唤起。</p>
      </div>

      <SettingsSectionCard
        title="AI 开关"
        description="开启后，空白段落按空格会唤起 AI 工具栏。"
      >
        <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
          <div className="space-y-1">
            <Label htmlFor="ai-enabled" className="cursor-pointer text-sm font-medium text-foreground">
              启用 AI 写作助手
            </Label>
          </div>
          <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="AI 来源"
        description="关闭 uTools AI 后，可改用自定义协议。"
      >
        <div className="space-y-3">
          <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
            <div className="space-y-1">
              <Label htmlFor="ai-custom-enabled" className="cursor-pointer text-sm font-medium text-foreground">
                关闭 utoolsAI 使用自定义 AI
              </Label>
            </div>
            <Switch
              id="ai-custom-enabled"
              checked={usingCustomProvider}
              onCheckedChange={(checked) => {
                setCustomSaveError(null);
                setCustomProviderEnabled(checked);
              }}
            />
          </div>

          {usingCustomProvider ? (
            <div className="space-y-3">
              <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">协议</Label>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[220px] justify-between rounded-[10px]">
                      <span className="truncate">{selectedProtocol.label}</span>
                      <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[280px]">
                    <DropdownMenuRadioGroup
                      value={customProtocol}
                      onValueChange={(value) => {
                        setCustomSaveError(null);
                        setCustomProtocol(value as CustomAIProtocol);
                      }}
                    >
                      {CUSTOM_PROTOCOL_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.id} value={option.id} className="items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{option.label}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {customProtocol === "openai" ? (
                <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
                  <Label htmlFor="custom-ai-base-url" className="text-sm font-medium text-foreground">
                    Base URL
                  </Label>
                  <Input
                    id="custom-ai-base-url"
                    value={customBaseURL}
                    onChange={(event) => {
                      setCustomSaveError(null);
                      setCustomBaseURL(event.target.value);
                    }}
                    placeholder="https://api.example.com/v1"
                    autoComplete="off"
                  />
                </div>
              ) : null}

              <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
                <Label htmlFor="custom-ai-api-key" className="text-sm font-medium text-foreground">
                  API Key
                </Label>
                <Input
                  id="custom-ai-api-key"
                  type="password"
                  value={customApiKey}
                  onChange={(event) => {
                    setCustomSaveError(null);
                    setCustomApiKey(event.target.value);
                  }}
                  placeholder="输入后点保存自动拉取模型"
                  autoComplete="off"
                />
              </div>

              <div className={cn("flex items-center justify-between gap-4 p-4", SETTINGS_OPTION_ROW_CLASS)}>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">保存配置</Label>
                </div>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={Boolean(saveButtonReason)}
                          onClick={() => {
                            void handleSaveCustomConfig();
                          }}
                          className={cn(Boolean(saveButtonReason) && "cursor-not-allowed")}
                        >
                          {savingCustomConfig ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {saveButtonReason ? (
                      <TooltipContent side="left">{saveButtonReason}</TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="AI 模型"
        description="从当前可用模型中选择默认模型。"
        actions={
          usingCustomProvider ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void handleSaveCustomConfig();
              }}
            >
              重新获取模型
            </Button>
          ) : enabled && aiSupported ? (
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
                            {!usingCustomProvider && loadingUToolsModels
                              ? "正在读取模型..."
                              : currentModel?.label ?? modelButtonReason ?? "请选择模型"}
                          </span>
                          <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[280px]">
                        <DropdownMenuRadioGroup
                          value={selectedModelId ?? ""}
                          onValueChange={(value) => setSelectedModelId(value)}
                        >
                          {currentModels.map((model) => (
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
        </div>
      </SettingsSectionCard>
    </div>
  );
}
