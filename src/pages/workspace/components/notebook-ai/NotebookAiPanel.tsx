import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAction,
} from "@/components/ui/popover";
/**
 * NotebookAiPanel — AI 聊天面板 UI（侧栏并排 / 全屏）
 *
 * 请求生命周期由 NotebookAiSessionProvider 持有：关面板或切页不会中止流式任务，
 * 顶栏 AI 图标继续反映运行/完成状态。
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import {
  X,
  Plus,
  CircleAlert,
  PanelRight,
  AppWindow,
  History as HistoryIcon,
  MoreHorizontal,
  Check,
} from "lucide-react";
import type { RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { ChatChrome } from "./beautiful-ui/ChatChrome";
import { ChatMessages } from "./ChatMessages";
import { Composer, type ComposerHandle } from "./Composer";
import { usePanelWidth } from "./usePanelWidth";
import { AiPanelResizeEdge } from "./AiPanelResizeEdge";
import { ConversationHistoryList } from "./ConversationHistoryPopover";
import type {
  NotebookAiLayoutMode,
  NotebookAiPanelSelectionCapture,
} from "./useNotebookAiPanel";
import { isFullscreenAiLayout } from "./useNotebookAiPanel";
import {
  clearAiHeaderActions,
  clearAiHeaderTitle,
  setAiHeaderActions,
  setAiHeaderTitle,
} from "./aiHeaderSlot";
import { getConversationSummary } from "@/lib/notebook-ai/conversationSummary";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import { buildAiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";
import {
  formatNotebookAiChatError,
  NOTEBOOK_AI_PLACEHOLDER_HINTS,
  useNotebookAiSession,
} from "./NotebookAiSession";
import type { NotebookAiImageAttachment } from "./Composer";
import { getCurrentNotebookAiPageId } from "@/lib/notebook-ai/context";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import { cn } from "@/lib/utils";
import { isElectronRuntime } from "@/lib/electron/runtime";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readEditorScale } from "./artifactPanZoomScale";
import { FOCUS_AI_COMPOSER_EVENT } from "@/components/editor/ai/composer/selectionQuote";
import {
  buildComposerDraftFromReference,
  resolveEmptySessionComposerSeed,
  shouldSeedCurrentPageReference,
} from "./defaultComposerReference";
import {
  clearAiPanelSurface,
  dismissAiFloatingLayers,
  setAiPanelSurface,
} from "./aiPanelSurface";

interface NotebookAiPanelProps {
  notebookId: string;
  onClose: () => void;
  editorRef?: RefObject<EditorRef | null>;
  capturedSelection?: NotebookAiPanelSelectionCapture | null;
  onConsumeCapturedSelection?: () => void;
  /** 打开方式：侧栏并排 / 全屏 */
  layoutMode?: NotebookAiLayoutMode;
  onLayoutModeChange?: (mode: NotebookAiLayoutMode) => void;
  /** 侧栏可拖宽；全屏铺满主区域 */
  variant?: "side-panel" | "fullscreen";
}

export function NotebookAiPanel({
  notebookId,
  onClose,
  editorRef: _editorRef,
  capturedSelection,
  onConsumeCapturedSelection,
  layoutMode = "side-panel",
  onLayoutModeChange,
  variant = "side-panel",
}: NotebookAiPanelProps) {
  // editorRef 由 SessionProvider 持有，面板侧仅保留 prop 兼容调用方签名
  void _editorRef;
  const isFullscreen = variant === "fullscreen";
  const isElectronChrome = isElectronRuntime();
  const layoutIsFullscreen = isFullscreenAiLayout(layoutMode);

  const { width, isResizing, onDragHandleMouseDown, onDragHandlePointerDown } =
    usePanelWidth();
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  // 展示宽度：随父级 flex 行可用空间收缩，避免 minWidth=stored 把面板裁出视口
  const [effectiveWidth, setEffectiveWidth] = useState(width);
  const composerRef = useRef<ComposerHandle | null>(null);
  const [bodyReady, setBodyReady] = useState(false);

  // 面板挂载=AI 任务面；卸载/切走时清 body 标记并收起残留浮层
  useEffect(() => {
    setAiPanelSurface({ active: true, fullscreen: isFullscreen });
    return () => {
      const root = panelRootRef.current;
      clearAiPanelSurface();
      dismissAiFloatingLayers(root);
    };
  }, [isFullscreen]);

  useEffect(() => {
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        setBodyReady(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, []);

  // 侧栏：观察父级（.workspace-editor-surface）宽度，计算不挤爆编辑区的 effectiveWidth
  useEffect(() => {
    if (isFullscreen) return;
    const root = panelRootRef.current;
    const parent = root?.parentElement;
    if (!parent) return;

    const EDITOR_MIN = 200;
    const recompute = () => {
      const parentW = parent.clientWidth;
      const room = parentW - EDITOR_MIN;
      // room 足够时：不超过 stored，且留给编辑区至少 EDITOR_MIN
      // 极窄时使用父级可用宽度，避免右侧裁切。
      const availableRoom = room > 0 ? room : Math.max(0, parentW);
      const next = Math.min(width, availableRoom);
      setEffectiveWidth(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [isFullscreen, width]);

  // 顶栏 AI 列与正文使用同一展示宽度，拖宽和窗口缩放时不各算一遍。
  useLayoutEffect(() => {
    if (isFullscreen || !isElectronChrome) return;
    const shell = panelRootRef.current?.closest<HTMLElement>(".workspace-shell");
    shell?.style.setProperty("--workspace-ai-width", `${effectiveWidth}px`);
    return () => { shell?.style.removeProperty("--workspace-ai-width"); };
  }, [effectiveWidth, isFullscreen, isElectronChrome]);

  // 输入条浮动叠在消息上：把 dock 高度换算进 zoom 坐标系，给消息区垫底。
  useLayoutEffect(() => {
    const dock = composerDockRef.current;
    const panel = panelRootRef.current;
    if (!dock || !panel) return;

    const sync = () => {
      const scale = readEditorScale(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--editor-scale",
        ),
      );
      panel.style.setProperty(
        "--ai-composer-float-pad",
        `${dock.offsetHeight / scale}px`,
      );
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(dock);
    window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, sync);
    return () => {
      ro.disconnect();
      window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, sync);
      panel.style.removeProperty("--ai-composer-float-pad");
    };
  }, []);
  // 只订当前活动页是否属于本笔记本（字符串），任意页自动保存不会重渲染面板。
  const fallbackPageId = usePages((state) => {
    const activeId = state.activePageId;
    if (activeId && state.pages[activeId]?.workspaceId === notebookId) {
      return activeId;
    }
    return null;
  });
  const notebooks = useNotebooks((state) => state.notebooks);

  const {
    conversationId,
    messages,
    error,
    clearError,
    isBusy,
    isStreaming,
    unavailableReason,
    placeholderIndex,
    composerRevision,
    suppressDefaultPageSeed,
    send,
    newConversation,
    ensureFreshConversation,
    compactConversation,
    selectConversation,
    deleteConversation,
    searchPages,
    onBatchApproval,
    onBatchUndo,
  } = useNotebookAiSession();

  const ensureFreshOnOpenRef = useRef(ensureFreshConversation);
  ensureFreshOnOpenRef.current = ensureFreshConversation;
  useEffect(() => {
    ensureFreshOnOpenRef.current();
  }, []);

  // 空会话默认 @ 跟随当前页：切笔记本 / 切页后再打开面板时换成最新笔记。
  // 用户已打字、加过其他 chip，或会话里已有消息，都保持原样。
  const currentPageId =
    getCurrentNotebookAiPageId(notebookId) ?? fallbackPageId;
  const initialReference = useMemo(() => {
    const page = currentPageId
      ? usePages.getState().pages[currentPageId]
      : undefined;
    return page ? buildAiFileReferenceAttrs(page, notebooks) : null;
  }, [currentPageId, notebooks]);
  const composerSeedContent = useMemo(
    () =>
      resolveEmptySessionComposerSeed(
        messages.length,
        useNotebookAiChats.getState().getComposerDraft(notebookId),
        initialReference,
        { suppress: suppressDefaultPageSeed },
      ),
    [
      initialReference,
      messages.length,
      notebookId,
      composerRevision,
      suppressDefaultPageSeed,
    ],
  );

  // Composer 挂载（或 key 重挂载）后：空会话且输入区仍是默认 @ 时跟到当前页。
  // /new 后 suppress：空输入 replaceable，不走这里，否则会把刚清掉的 tag 种回去。
  useEffect(() => {
    if (!bodyReady || !initialReference) return;
    const draft = useNotebookAiChats.getState().getComposerDraft(notebookId);
    if (
      !shouldSeedCurrentPageReference(messages.length, draft, currentPageId, {
        suppress: suppressDefaultPageSeed,
      })
    ) {
      return;
    }
    const timer = setTimeout(() => {
      const result =
        composerRef.current?.replaceDefaultPageReference(initialReference);
      if (result === "skipped") return;
      useNotebookAiChats
        .getState()
        .setComposerDraft(
          notebookId,
          buildComposerDraftFromReference(initialReference),
        );
    }, 0);
    return () => clearTimeout(timer);
  }, [
    bodyReady,
    currentPageId,
    initialReference,
    messages.length,
    composerRevision,
    notebookId,
    suppressDefaultPageSeed,
  ]);

  // 面板打开即聚焦输入框；/new 重挂 Composer 后同样拉回焦点。
  // 已打开时重复触发「打开」走 goose-note:focus-ai-composer
  useEffect(() => {
    if (unavailableReason || !bodyReady) return;
    const focusComposer = () => composerRef.current?.focus();
    const timer = window.setTimeout(focusComposer, 50);
    window.addEventListener(FOCUS_AI_COMPOSER_EVENT, focusComposer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(FOCUS_AI_COMPOSER_EVENT, focusComposer);
    };
  }, [unavailableReason, bodyReady, composerRevision]);

  const handlePanelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      onClose();
    },
    [onClose],
  );

  // 全屏覆盖主区：Esc 在输入框失焦（点消息、侧栏、空白）后仍须退出。
  // ChatChrome onKeyDown 只在焦点位于面板子树时冒泡；Composer onEscape 只在输入框内。
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isImeKeyboardEvent(event)) return;
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        )
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, onClose]);

  const composerPlaceholder = unavailableReason
    ? "请先在设置中配置 AI 模型"
    : isBusy
      ? "正在生成结果…"
      : NOTEBOOK_AI_PLACEHOLDER_HINTS[placeholderIndex];

  const handleSend = useCallback(
    (
      payload: AiComposerPayload,
      imageAttachments: NotebookAiImageAttachment[],
    ) => {
      return send(payload, imageAttachments, {
        capturedSelection,
        onConsumeCapturedSelection,
      });
    },
    [send, capturedSelection, onConsumeCapturedSelection],
  );

  const handleNewConversation = useCallback(() => {
    newConversation({ onConsumeCapturedSelection });
  }, [newConversation, onConsumeCapturedSelection]);

  const handleSlashCommand = useCallback(
    (id: "new" | "compact") => {
      if (id === "new") {
        handleNewConversation();
        return;
      }
      compactConversation();
    },
    [compactConversation, handleNewConversation],
  );

  const handleSelectConversation = useCallback(
    (nextConversationId: string) => {
      selectConversation(nextConversationId, { onConsumeCapturedSelection });
    },
    [selectConversation, onConsumeCapturedSelection],
  );

  const handleDeleteConversation = useCallback(
    (targetConversationId: string) => {
      deleteConversation(targetConversationId);
    },
    [deleteConversation],
  );

  const streamingMessageId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1].id
      : undefined;

  const conversationSummary = useMemo(
    () => getConversationSummary(messages),
    [messages],
  );

  // 全屏时工具栏上移到 PageHeader 右上角（顶替 PageMenu）
  const headerToolbar = useMemo(() => {
    const iconBtn =
      "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-[var(--goose-interactive-selected)] dark:data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]";
    return (
      <TooltipProvider delayDuration={300}>
        <div
          className="flex items-center gap-0.5"
          role="toolbar"
          aria-label="AI 工具栏"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleNewConversation}
                className={iconBtn}
                aria-label="新建会话"
                disabled={isBusy}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>新建会话</TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={iconBtn} aria-label="历史会话">
                <HistoryIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-72 max-w-72 overflow-hidden p-0"
            >
              <ConversationHistoryList
                notebookId={notebookId}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
              />
            </PopoverContent>
          </Popover>

          {onLayoutModeChange ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="更多面板选项"
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} className="w-48 p-1">
                <PopoverAction
                  onSelect={() => onLayoutModeChange("side-panel")}
                  className="gap-2"
                >
                  <PanelRight className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">侧栏并排</span>
                  {!layoutIsFullscreen ? <Check className="h-3.5 w-3.5" /> : null}
                </PopoverAction>
                <PopoverAction
                  onSelect={() => onLayoutModeChange("fullscreen")}
                  className="gap-2"
                >
                  <AppWindow className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">全屏</span>
                  {layoutIsFullscreen ? <Check className="h-3.5 w-3.5" /> : null}
                </PopoverAction>
              </PopoverContent>
            </Popover>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className={iconBtn}
                aria-label="关闭 AI"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>关闭 AI</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }, [
    onClose,
    handleNewConversation,
    isBusy,
    notebookId,
    handleSelectConversation,
    handleDeleteConversation,
    onLayoutModeChange,
    layoutIsFullscreen,
  ]);

  // 桌面两种布局都把工具栏交给顶栏；网页侧栏仍保留面板内标题。
  useEffect(() => {
    if (!isFullscreen && !isElectronChrome) {
      clearAiHeaderActions();
      clearAiHeaderTitle();
      return;
    }
    setAiHeaderActions(headerToolbar);
    setAiHeaderTitle(conversationSummary);
    return () => {
      clearAiHeaderActions();
      clearAiHeaderTitle();
    };
  }, [isFullscreen, isElectronChrome, headerToolbar, conversationSummary]);

  return (
    <div
      ref={panelRootRef}
      data-ai-panel-layout={isFullscreen ? "fullscreen" : "side-panel"}
      className={cn(
        "relative flex h-full min-h-0 flex-col",
        isFullscreen ? "min-w-0 w-full flex-1" : "z-[50] shrink-0",
      )}
      style={
        isFullscreen ? undefined : { width: effectiveWidth, maxWidth: "100%" }
      }
    >
      {!isFullscreen ? (
        <AiPanelResizeEdge
          isResizing={isResizing}
          onMouseDown={(event) => onDragHandleMouseDown(event, effectiveWidth)}
          onPointerDown={(event) =>
            onDragHandlePointerDown(event, effectiveWidth)
          }
        />
      ) : null}

      <ChatChrome
        onKeyDown={handlePanelKeyDown}
        className="notebook-ai-shell relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
      >
        {!isFullscreen && !isElectronChrome ? (
          <header className="notebook-ai-panel-header flex h-12 shrink-0 items-center gap-2 px-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              AI 助手
            </span>
            <div className="flex shrink-0 items-center">{headerToolbar}</div>
          </header>
        ) : null}

        <div className="notebook-ai-zoom-slot notebook-ai-content-surface">
          <div className="notebook-ai-zoom-surface">
            {!bodyReady ? null : unavailableReason ? (
              <div className="flex flex-1 items-center justify-center px-6 pb-[var(--ai-composer-float-pad,7.5rem)]">
                <div className="flex max-w-[260px] flex-col items-center gap-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--goose-interactive-hover)] text-muted-foreground">
                    <CircleAlert className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    AI 暂不可用
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {unavailableReason}
                  </p>
                </div>
              </div>
            ) : (
              <ChatMessages
                messages={messages}
                onEmptySuggestion={(text) => {
                  const reference = initialReference
                    ? { ...initialReference, role: "target" as const }
                    : null;
                  const tokens = reference
                    ? [
                        {
                          type: "reference" as const,
                          reference,
                          role: "target" as const,
                        },
                        { type: "text" as const, text: `\n${text}` },
                      ]
                    : [{ type: "text" as const, text }];
                  void handleSend(
                    {
                      promptText: text,
                      freeformText: text,
                      references: reference ? [reference] : [],
                      images: [],
                      skills: [],
                      tokens,
                    },
                    [],
                  );
                }}
                streamingMessageId={streamingMessageId}
                editorRef={_editorRef}
                layout={isFullscreen ? "fullscreen" : "side-panel"}
                onBatchApproval={onBatchApproval}
                onBatchUndo={onBatchUndo}
              />
            )}
          </div>
        </div>

        <div ref={composerDockRef} className="notebook-ai-composer-dock">
          {bodyReady && error ? (
            <div
              className={cn(
                "pointer-events-auto mb-2 w-full",
                isFullscreen ? "px-6" : "px-0",
              )}
            >
              <div
                className={cn(
                  "flex items-start gap-2 rounded-[10px] border border-[var(--goose-color-danger-focus)] bg-[var(--goose-color-danger-subtle-bg)] px-3 py-2.5 text-xs",
                  isFullscreen && "mx-auto max-w-[720px]",
                )}
                role="alert"
              >
                <CircleAlert
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--goose-color-danger-focus)]"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--goose-color-danger-focus)]">
                    本轮失败原因
                  </div>
                  <div className="mt-0.5 break-words leading-relaxed text-foreground">
                    {formatNotebookAiChatError(error)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => clearError()}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[var(--goose-color-danger-focus)] outline-none transition-colors hover:bg-[var(--goose-color-danger-subtle-bg)]"
                  aria-label="关闭错误提示"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : null}

          {bodyReady ? (
            <Composer
              ref={composerRef}
              key={`${notebookId}-${composerRevision}`}
              notebookId={notebookId}
              conversationId={conversationId}
              initialContent={composerSeedContent}
              onSend={handleSend}
              onSlashCommand={handleSlashCommand}
              isStreaming={isBusy}
              disabled={!!unavailableReason}
              placeholder={composerPlaceholder}
              searchPages={searchPages}
              onEscape={onClose}
              layout={isFullscreen ? "fullscreen" : "side-panel"}
            />
          ) : (
            <div className="h-[4.75rem]" aria-hidden />
          )}
        </div>
      </ChatChrome>
    </div>
  );
}
