import { useEffect, useMemo } from "react";
import {
  Plus,
  X,
  PanelRight,
  AppWindow,
  History as HistoryIcon,
  MoreHorizontal,
  Check,
} from "@/components/ui/icons";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAction,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConversationHistoryList } from "../ConversationHistoryPopover";
import {
  clearAiHeaderActions,
  clearAiHeaderTitle,
  setAiHeaderActions,
  setAiHeaderTitle,
} from "../aiHeaderSlot";
import type { NotebookAiPanelProps } from "./types";
import type { PanelCommands } from "./usePanelCommands";
export function usePanelHeader(
  props: NotebookAiPanelProps,
  commands: PanelCommands,
  options: {
    isFullscreen: boolean;
    isElectronChrome: boolean;
    layoutIsFullscreen: boolean;
    isBusy: boolean;
    conversationSummary: string;
  },
) {
  const { notebookId, onClose, onLayoutModeChange } = props;
  const {
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
  } = commands;
  const {
    isFullscreen,
    isElectronChrome,
    layoutIsFullscreen,
    isBusy,
    conversationSummary,
  } = options;
  // 全屏时工具栏上移到 PageHeader 右上角（顶替 PageMenu）
  const headerToolbar = useMemo(() => {
    const iconBtn =
      "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:hover:bg-[var(--goose-interactive-hover)] disabled:pointer-events-none disabled:text-disabled data-[state=open]:bg-[var(--goose-interactive-selected)] dark:data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]";
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
                  {!layoutIsFullscreen ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                </PopoverAction>
                <PopoverAction
                  onSelect={() => onLayoutModeChange("fullscreen")}
                  className="gap-2"
                >
                  <AppWindow className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">全屏</span>
                  {layoutIsFullscreen ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
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

  return headerToolbar;
}
