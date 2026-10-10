/** 面板 UI 仅消费常驻会话，关闭面板不会停止生成。 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { ChatChrome } from "./beautiful-ui/ChatChrome";
import { AiPanelResizeEdge } from "./AiPanelResizeEdge";
import { isFullscreenAiLayout } from "./useNotebookAiPanel";
import { useNotebookAiSession } from "./NotebookAiSession";
import { getConversationSummary } from "@/lib/notebook-ai/conversationSummary";
import type { NotebookAiPanelProps } from "./panel/types";
import { usePanelSurface } from "./panel/usePanelSurface";
import { usePanelComposerSeed } from "./panel/usePanelComposerSeed";
import { usePanelCommands } from "./panel/usePanelCommands";
import { usePanelHeader } from "./panel/usePanelHeader";
import { NotebookAiPanelBody } from "./panel/NotebookAiPanelBody";
export function NotebookAiPanel(props: NotebookAiPanelProps) {
  const {
    notebookId,
    editorRef: _editorRef,
    layoutMode = "side-panel",
    variant = "side-panel",
  } = props;
  // editorRef 由 SessionProvider 持有，面板侧仅保留 prop 兼容调用方签名
  void _editorRef;
  const isFullscreen = variant === "fullscreen";
  const isElectronChrome = isElectronRuntime();
  const layoutIsFullscreen = isFullscreenAiLayout(layoutMode);

  const surface = usePanelSurface(isFullscreen, isElectronChrome);
  const {
    panelRootRef,
    effectiveWidth,
    isResizing,
    onDragHandleMouseDown,
    onDragHandlePointerDown,
  } = surface;
  const session = useNotebookAiSession();
  const { messages, isStreaming, isBusy } = session;
  const seed = usePanelComposerSeed(notebookId, session, surface);
  const commands = usePanelCommands(props, session, isFullscreen);
  const { handlePanelKeyDown } = commands;
  const streamingMessageId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1].id
      : undefined;

  const conversationSummary = useMemo(
    () => getConversationSummary(messages),
    [messages],
  );

  const headerToolbar = usePanelHeader(props, commands, {
    isFullscreen,
    isElectronChrome,
    layoutIsFullscreen,
    isBusy,
    conversationSummary,
  });
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

        <NotebookAiPanelBody
          props={props}
          session={session}
          surface={surface}
          commands={commands}
          seed={seed}
          isFullscreen={isFullscreen}
          streamingMessageId={streamingMessageId}
        />
      </ChatChrome>
    </div>
  );
}
