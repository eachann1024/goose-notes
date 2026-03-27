import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  getAvailableAIModelOptions,
  type AIModelOption,
  type AIReasoningLevel,
} from "@/lib/ai-provider";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import {
  AiComposerInput,
  type AiComposerInputHandle,
} from "../editor/ai-composer/AiComposerInput";
import type { AiFileReferenceAttrs } from "../editor/ai-composer/referenceLookup";

interface AiWorkspaceComposerBarProps {
  composerRef: MutableRefObject<AiComposerInputHandle | null>;
  composerFocusToken: number;
  isStreaming: boolean;
  onSubmit: (params: {
    selectedModelId: string | null;
    reasoningLevel: AIReasoningLevel;
  }) => void;
  onReferenceAdded: (reference: AiFileReferenceAttrs) => void;
}

const REASONING_LEVEL_OPTIONS: Array<{
  id: AIReasoningLevel;
  label: string;
  description: string;
}> = [
  {
    id: "low",
    label: "低",
    description: "优先更快返回，尽量少走深推理。",
  },
  {
    id: "medium",
    label: "中",
    description: "平衡速度和推理深度。",
  },
  {
    id: "high",
    label: "高",
    description: "尽量给更完整的推理空间。",
  },
];

export function AiWorkspaceComposerBar({
  composerRef,
  composerFocusToken,
  isStreaming,
  onSubmit,
  onReferenceAdded,
}: AiWorkspaceComposerBarProps) {
  const ai = useSettings((state) => state.ai);
  const setAIWorkspaceSelectedModelId = useSettings((state) => state.setAIWorkspaceSelectedModelId);
  const setAIWorkspaceReasoningLevel = useSettings((state) => state.setAIWorkspaceReasoningLevel);

  const [modelOptions, setModelOptions] = useState<AIModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadModelOptions() {
      if (!ai.enabled) {
        setModelOptions([]);
        setModelLoadError("请先在设置里开启 AI 助手");
        return;
      }

      setLoadingModels(true);
      setModelLoadError(null);

      try {
        const nextModels = await getAvailableAIModelOptions(ai);
        if (!active) return;

        setModelOptions(nextModels);
        if (nextModels.length === 0) {
          setModelLoadError("暂无可选模型");
        }
      } catch (error) {
        if (!active) return;
        setModelOptions([]);
        setModelLoadError(error instanceof Error ? error.message : "读取模型列表失败");
      } finally {
        if (active) {
          setLoadingModels(false);
        }
      }
    }

    void loadModelOptions();

    return () => {
      active = false;
    };
  }, [ai.customModelOptions, ai.customProtocol, ai.enabled, ai.useCustomProvider]);

  const resolvedModelId = useMemo(() => {
    if (!modelOptions.length) {
      return null;
    }

    if (ai.workspaceSelectedModelId && modelOptions.some((item) => item.id === ai.workspaceSelectedModelId)) {
      return ai.workspaceSelectedModelId;
    }

    if (ai.selectedModelId && modelOptions.some((item) => item.id === ai.selectedModelId)) {
      return ai.selectedModelId;
    }

    return modelOptions[0]?.id ?? null;
  }, [ai.selectedModelId, ai.workspaceSelectedModelId, modelOptions]);

  useEffect(() => {
    if (resolvedModelId === ai.workspaceSelectedModelId) {
      return;
    }

    setAIWorkspaceSelectedModelId(resolvedModelId);
  }, [ai.workspaceSelectedModelId, resolvedModelId, setAIWorkspaceSelectedModelId]);

  const currentModel = modelOptions.find((item) => item.id === resolvedModelId) ?? null;
  const currentReasoning = REASONING_LEVEL_OPTIONS.find((item) => item.id === ai.workspaceReasoningLevel)
    ?? REASONING_LEVEL_OPTIONS[2];

  const modelButtonDisabled = loadingModels || Boolean(modelLoadError) || !modelOptions.length;
  const modelButtonReason = loadingModels
    ? "模型列表读取中，请稍候"
    : modelLoadError || (!modelOptions.length ? "暂无可选模型" : null);

  const handleSubmit = () => {
    onSubmit({
      selectedModelId: resolvedModelId,
      reasoningLevel: ai.workspaceReasoningLevel,
    });
  };

  return (
    <div className="shrink-0 px-3 pb-3 pt-2">
      <div
        data-ai-workspace-composer="true"
        className="rounded-[28px] border border-border/70 bg-background/96 px-2.5 pb-2.5 pt-3 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-[10px]"
      >
        <div className="px-3">
          <AiComposerInput
            ref={composerRef}
            placeholder="问当前页面，或 @ 其他页面 / 本地文件..."
            autoFocusToken={composerFocusToken}
            onSubmit={handleSubmit}
            onEscape={() => composerRef.current?.clear()}
            onReferenceAdded={onReferenceAdded}
            variant="panel"
          />
        </div>

        <div className="mt-2.5 h-px bg-border/70" />

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={modelButtonDisabled}
                          data-ai-workspace-model-trigger="true"
                          className={cn(
                            "max-w-[220px] justify-between rounded-full border border-border/70 bg-muted/35 px-3 text-muted-foreground hover:bg-muted/55 hover:text-foreground",
                            modelButtonDisabled && "cursor-not-allowed",
                          )}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <LucideIcons.Zap className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {currentModel?.label ?? modelButtonReason ?? "请选择模型"}
                            </span>
                          </span>
                          <LucideIcons.ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[320px]">
                        <DropdownMenuRadioGroup
                          value={resolvedModelId ?? ""}
                          onValueChange={(value) => setAIWorkspaceSelectedModelId(value)}
                        >
                          {modelOptions.map((model) => (
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
                  <TooltipContent side="top">{modelButtonReason}</TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-ai-workspace-reasoning-trigger="true"
                  className="justify-between rounded-full border border-border/70 bg-muted/35 px-3 text-muted-foreground hover:bg-muted/55 hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <LucideIcons.Brain className="h-3.5 w-3.5 shrink-0" />
                    <span>{currentReasoning.label}</span>
                  </span>
                  <LucideIcons.ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                <DropdownMenuRadioGroup
                  value={ai.workspaceReasoningLevel}
                  onValueChange={(value) => setAIWorkspaceReasoningLevel(value as AIReasoningLevel)}
                >
                  {REASONING_LEVEL_OPTIONS.map((option) => (
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

          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={isStreaming}
            data-ai-workspace-send="true"
            title={isStreaming ? "生成中…" : "发送"}
            className={cn(
              "h-10 w-10 rounded-full shadow-none",
              isStreaming && "cursor-not-allowed",
            )}
          >
            {isStreaming ? (
              <LucideIcons.LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LucideIcons.ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
