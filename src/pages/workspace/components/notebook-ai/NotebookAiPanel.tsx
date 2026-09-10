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
  MoreHorizontal,
  PanelRight,
  AppWindow,
  History as HistoryIcon,
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
import {
  usePanelWidth,
  PANEL_WIDTH_MIN,
  PANEL_WIDTH_MAX,
} from "./usePanelWidth";
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
import { ConversationTitle } from "./ConversationTitle";
import {
  getConversationSummary,
  isEmptyConversationSummary,
} from "@/lib/notebook-ai/conversationSummary";
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
import { cn } from "@/lib/utils";
import { readEditorScale } from "./artifactPanZoomScale";
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
    const GAP = 8;

    const recompute = () => {
      const parentW = parent.clientWidth;
      const room = parentW - EDITOR_MIN - GAP;
      // room 足够时：不超过 stored / MAX，且留给编辑区至少 EDITOR_MIN
      // 极窄时（如 Electron 窄窗口）：让面板占用扣除 flex gap 后的可用宽度，避免右侧裁切
      const availableRoom = room > 0 ? room : Math.max(0, parentW - GAP);
      const next = Math.min(width, Math.min(PANEL_WIDTH_MAX, availableRoom));
      setEffectiveWidth(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [isFullscreen, width]);

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
    compactConversation,
    selectConversation,
    deleteConversation,
    searchPages,
    onBatchApproval,
    onBatchUndo,
  } = useNotebookAiSession();

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
    window.addEventListener("goose-note:focus-ai-composer", focusComposer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("goose-note:focus-ai-composer", focusComposer);
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

  // 会话标题只在历史列表展示；全屏时工具栏上移到 PageHeader 右上角（顶替 PageMenu）
  const headerToolbar = useMemo(() => {
    const iconBtn =
      "flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-[var(--goose-icon-chip-on-selected)] dark:data-[state=open]:bg-[var(--goose-interactive-hover)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]";
    return (
      <div
        className="flex items-center gap-0.5"
        role="toolbar"
        aria-label="AI 工具栏"
      >
        <button
          type="button"
          onClick={handleNewConversation}
          className={iconBtn}
          aria-label="新建会话"
          title="新建会话"
          disabled={isBusy}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={iconBtn}
              aria-label="更多选项"
              title="更多"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-56">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm hover:bg-[var(--goose-interactive-selected)]"
                >
                  <HistoryIcon className="h-4 w-4" strokeWidth={1.75} />
                  <span>历史会话</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
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
              <>
                <div role="separator" className="my-1 h-px bg-border" />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  打开方式
                </div>
                <PopoverAction
                  onSelect={() => onLayoutModeChange("side-panel")}
                  className="gap-2"
                >
                  <PanelRight className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">侧栏并排</span>
                  {!layoutIsFullscreen ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : null}
                </PopoverAction>
                <PopoverAction
                  onSelect={() => onLayoutModeChange("fullscreen")}
                  className="gap-2"
                >
                  <AppWindow className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">全屏</span>
                  {layoutIsFullscreen ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : null}
                </PopoverAction>
              </>
            ) : null}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={onClose}
          className={iconBtn}
          aria-label="关闭 AI"
          title="关闭 AI"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
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

  // 全屏：工具栏挂到标签栏右上角；侧栏并排：仍在面板内右上角
  useEffect(() => {
    if (!isFullscreen) {
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
  }, [isFullscreen, headerToolbar, conversationSummary]);

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
        className={cn(
          "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden gap-2",
          isFullscreen
            ? "min-w-0 w-full flex-1 bg-[hsl(var(--goose-shell-bg))] px-2 pb-2 pt-0"
            : "bg-[hsl(var(--goose-shell-bg))] px-2 pb-2",
        )}
      >
        {!isFullscreen ? (
          <header className="notebook-ai-panel-header flex h-12 shrink-0 items-center gap-2 rounded-[12px] bg-[hsl(var(--goose-editor-bg))] px-2.5">
            <ConversationTitle
              summary={conversationSummary}
              muted={isEmptyConversationSummary(conversationSummary)}
            />
            <div className="flex shrink-0 items-center">{headerToolbar}</div>
          </header>
        ) : null}

        <div
          className={cn(
            "notebook-ai-zoom-slot rounded-[12px] bg-[hsl(var(--goose-editor-bg))]",
            isFullscreen && "min-h-0 flex-1",
          )}
        >
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
