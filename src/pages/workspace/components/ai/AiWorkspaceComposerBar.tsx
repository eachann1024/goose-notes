import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent,
  useState,
  type MutableRefObject,
  type PointerEvent,
} from "react";
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
import type { JSONContent } from "@/types";

interface AiWorkspaceComposerBarProps {
  composerRef: MutableRefObject<AiComposerInputHandle | null>;
  composerFocusToken: number;
  isStreaming: boolean;
  draftContent: JSONContent | null;
  onSubmit: (params: {
    selectedModelId: string | null;
    reasoningLevel: AIReasoningLevel;
  }) => void;
  onDraftChange: (content: JSONContent | null) => void;
  onReferenceAdded: (reference: AiFileReferenceAttrs) => void;
}

const REASONING_LEVEL_OPTIONS: Array<{
  id: AIReasoningLevel;
  label: string;
  description: string;
}> = [
  {
    id: "default",
    label: "默认",
    description: "不额外传思考长度，交给第三方模型自己决定。",
  },
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

const AI_WORKSPACE_PLACEHOLDER_PRESETS = [
  "可以这样说：帮我写一篇关于新能源固态电池的抖音口播脚本",
  "可以这样说：结合 @竞品拆解，帮我出 5 条小红书标题",
  "可以这样说：参考 @采访纪要，整理一版公众号推文",
  "可以这样说：把 @会议记录 润色成对外可发的项目周报",
  "可以这样说：基于 @产品说明，写一版直播口播稿",
  "可以这样说：参考 @需求文档，帮我起草一版 PRD 摘要",
  "可以这样说：把这页内容改成更适合老板看的汇报口径",
  "可以这样说：结合 @用户反馈，整理 10 条短视频选题",
  "可以这样说：参考 @发布节奏，帮我排一周小红书选题",
  "可以这样说：把 @采访提纲 扩成一篇人物稿",
  "可以这样说：结合 @课程大纲，生成一版招生海报文案",
  "可以这样说：参考 @商品卖点，写一版电商详情页文案",
  "可以这样说：把 @竞品评论区 提炼成用户痛点清单",
  "可以这样说：帮我写一份适合抖音的 60 秒短视频脚本",
  "可以这样说：帮我生成一篇新能源固态电池科普笔记",
  "可以这样说：帮我起草一封更体面的商务跟进邮件",
  "可以这样说：结合 @销售录音，整理客户异议与回应话术",
  "可以这样说：把 @方案初稿 润色得更专业、更可信",
  "可以这样说：参考 @培训笔记，整理成 SOP 流程",
  "可以这样说：帮我把这页内容压缩成 3 条结论",
  "可以这样说：结合 @品牌手册，改成统一语气",
  "可以这样说：参考 @数据复盘，写一版老板能快速看懂的结论",
  "可以这样说：帮我列 10 个更像爆款的小红书开头",
  "可以这样说：帮我把这个想法扩成一篇完整提案",
  "可以这样说：参考 @脚本A @脚本B，融合成一版新脚本",
  "可以这样说：通过 @文件名 引用资料，我会一起参考",
  "可以这样说：像“帮我生成一份…”这类请求，会默认在当前记事本根目录新建笔记",
  "可以这样说：如果要写到指定页面，直接说“生成到 @页面名”",
  "可以这样说：如果只想聊一聊，直接说“仅聊天”或“不要写入”",
  "可以这样说：需要改现有内容时，说“追加到当前页”或“替换 @页面名”",
  "可以这样说：帮我把这份数据做成一个柱状图",
  "可以这样说：用折线图展示这几个月的增长趋势",
  "可以这样说：把 @数据表 可视化成交互式对比图",
  "可以这样说：生成一个能点击筛选的数据 Dashboard",
];

const COMPOSER_MENU_VIEWPORT_PADDING = 16;
const COMPOSER_MENU_TRIGGER_GAP = 10;
const MODEL_MENU_MAX_HEIGHT = 416;
const REASONING_MENU_MAX_HEIGHT = 320;
const COMPOSER_MENU_MIN_PREFERRED_HEIGHT = 180;

type ComposerMenuSide = "top" | "bottom";

function getComposerMenuPlacement(
  trigger: HTMLButtonElement | null,
  preferredMaxHeight: number,
) : { side: ComposerMenuSide; maxHeight: number } {
  if (!trigger || typeof window === "undefined") {
    return { side: "top", maxHeight: preferredMaxHeight };
  }

  const { top, bottom } = trigger.getBoundingClientRect();
  const availableAbove = Math.max(
    0,
    Math.floor(top - COMPOSER_MENU_VIEWPORT_PADDING - COMPOSER_MENU_TRIGGER_GAP),
  );
  const availableBelow = Math.max(
    0,
    Math.floor(window.innerHeight - bottom - COMPOSER_MENU_VIEWPORT_PADDING - COMPOSER_MENU_TRIGGER_GAP),
  );

  const side: ComposerMenuSide = (
    availableAbove >= COMPOSER_MENU_MIN_PREFERRED_HEIGHT
    || availableAbove >= availableBelow
  )
    ? "top"
    : "bottom";

  const maxHeight = Math.min(
    preferredMaxHeight,
    side === "top" ? availableAbove : availableBelow,
  );

  return {
    side,
    maxHeight: Math.max(120, maxHeight),
  };
}

function preventDropdownTriggerPointerDown(event: PointerEvent<HTMLButtonElement>) {
  if (event.button !== 0 || event.ctrlKey) {
    return;
  }

  event.preventDefault();
}

export function AiWorkspaceComposerBar({
  composerRef,
  composerFocusToken,
  isStreaming,
  draftContent,
  onSubmit,
  onDraftChange,
  onReferenceAdded,
}: AiWorkspaceComposerBarProps) {
  const ai = useSettings((state) => state.ai);
  const setAIWorkspaceSelectedModelId = useSettings((state) => state.setAIWorkspaceSelectedModelId);
  const setAIWorkspaceReasoningLevel = useSettings((state) => state.setAIWorkspaceReasoningLevel);

  const [modelOptions, setModelOptions] = useState<AIModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isComposerEmpty, setIsComposerEmpty] = useState(true);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [reasoningMenuOpen, setReasoningMenuOpen] = useState(false);
  const [modelMenuMaxHeight, setModelMenuMaxHeight] = useState(MODEL_MENU_MAX_HEIGHT);
  const [reasoningMenuMaxHeight, setReasoningMenuMaxHeight] = useState(REASONING_MENU_MAX_HEIGHT);
  const [modelMenuSide, setModelMenuSide] = useState<ComposerMenuSide>("top");
  const [reasoningMenuSide, setReasoningMenuSide] = useState<ComposerMenuSide>("top");
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reasoningTriggerRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((current) =>
        current >= AI_WORKSPACE_PLACEHOLDER_PRESETS.length - 1 ? 0 : current + 1,
      );
    }, 6600);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
    ?? REASONING_LEVEL_OPTIONS[0];
  const supportsReasoningLevel = ai.useCustomProvider;

  const modelButtonDisabled = loadingModels || Boolean(modelLoadError) || !modelOptions.length;
  const modelButtonReason = loadingModels
    ? "模型列表读取中，请稍候"
    : modelLoadError || (!modelOptions.length ? "暂无可选模型" : null);

  useLayoutEffect(() => {
    if (!modelMenuOpen && !reasoningMenuOpen) {
      return;
    }

    let rafId = 0;

    const measure = () => {
      if (modelMenuOpen) {
        const placement = getComposerMenuPlacement(modelTriggerRef.current, MODEL_MENU_MAX_HEIGHT);
        setModelMenuSide(placement.side);
        setModelMenuMaxHeight(placement.maxHeight);
      }
      if (reasoningMenuOpen) {
        const placement = getComposerMenuPlacement(reasoningTriggerRef.current, REASONING_MENU_MAX_HEIGHT);
        setReasoningMenuSide(placement.side);
        setReasoningMenuMaxHeight(placement.maxHeight);
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [modelMenuOpen, reasoningMenuOpen]);

  const handleSubmit = () => {
    onSubmit({
      selectedModelId: resolvedModelId,
      reasoningLevel: ai.workspaceReasoningLevel,
    });
  };

  const toggleModelMenu = (_event: MouseEvent<HTMLButtonElement>) => {
    setReasoningMenuOpen(false);
    if (!modelMenuOpen) {
      const placement = getComposerMenuPlacement(modelTriggerRef.current, MODEL_MENU_MAX_HEIGHT);
      setModelMenuSide(placement.side);
      setModelMenuMaxHeight(placement.maxHeight);
    }
    setModelMenuOpen((open) => !open);
  };

  const toggleReasoningMenu = (_event: MouseEvent<HTMLButtonElement>) => {
    setModelMenuOpen(false);
    if (!reasoningMenuOpen) {
      const placement = getComposerMenuPlacement(reasoningTriggerRef.current, REASONING_MENU_MAX_HEIGHT);
      setReasoningMenuSide(placement.side);
      setReasoningMenuMaxHeight(placement.maxHeight);
    }
    setReasoningMenuOpen((open) => !open);
  };

  return (
    <div className="shrink-0 px-3 pb-3 pt-2">
      <div
        data-ai-workspace-composer="true"
        className="rounded-3xl border border-border/70 bg-background/96 px-2 pb-2 pt-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur-[10px]"
      >
        <div className="px-2.5">
          <AiComposerInput
            ref={composerRef}
            placeholder="输入问题或生成需求"
            placeholderOverlayText={AI_WORKSPACE_PLACEHOLDER_PRESETS[placeholderIndex]}
            autoFocusToken={composerFocusToken}
            onSubmit={handleSubmit}
            onEscape={() => composerRef.current?.clear()}
            initialContent={draftContent}
            onContentChange={onDraftChange}
            onIsEmptyChange={setIsComposerEmpty}
            onReferenceAdded={onReferenceAdded}
            variant="panel"
          />
        </div>

        <div className="mt-2 h-px bg-border/70" />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenu open={modelMenuOpen} onOpenChange={setModelMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          ref={modelTriggerRef}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onPointerDown={preventDropdownTriggerPointerDown}
                          onClick={toggleModelMenu}
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
                      <DropdownMenuContent
                        align="start"
                        side={modelMenuSide}
                        sideOffset={COMPOSER_MENU_TRIGGER_GAP}
                        avoidCollisions={false}
                        style={{ maxHeight: `${modelMenuMaxHeight}px` }}
                        className="w-[320px]"
                      >
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

            {supportsReasoningLevel ? (
              <DropdownMenu open={reasoningMenuOpen} onOpenChange={setReasoningMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={reasoningTriggerRef}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onPointerDown={preventDropdownTriggerPointerDown}
                    onClick={toggleReasoningMenu}
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
                <DropdownMenuContent
                  align="start"
                  side={reasoningMenuSide}
                  sideOffset={COMPOSER_MENU_TRIGGER_GAP}
                  avoidCollisions={false}
                  style={{ maxHeight: `${reasoningMenuMaxHeight}px` }}
                  className="w-[220px]"
                >
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
            ) : null}
          </div>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSubmit}
                  disabled={isStreaming || isComposerEmpty}
                  data-ai-workspace-send="true"
                  className={cn(
                    "h-9 w-9 rounded-full shadow-none transition-colors duration-150",
                    isComposerEmpty || isStreaming
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "hover:bg-primary/85 active:bg-primary/75 active:scale-95 dark:hover:bg-primary/80 dark:active:bg-primary/65",
                  )}
                >
                  {isStreaming ? (
                    <LucideIcons.LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <LucideIcons.ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isStreaming ? "生成中…" : isComposerEmpty ? "请先输入内容" : "发送"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
