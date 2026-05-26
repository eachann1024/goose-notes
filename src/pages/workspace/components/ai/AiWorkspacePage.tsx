import { useEffect, useRef, type RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EDITOR_FONT_SIZE_DEFAULT,
  useSettings,
} from "@/stores/useSettings";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCompactViewport } from "@/hooks/useCompactViewport";
import { AiPromptComposer } from "./AiPromptComposer";
import { AiSessionHistoryPanel } from "./AiSessionHistoryPanel";
import { AiWorkspaceMessages } from "./AiWorkspaceMessages";
import type { EditorRef } from "../editor/Editor";
import { useAiWorkspaceState } from "./hooks/useAiWorkspaceState";
import type { AiFileReferenceAttrs } from "../editor/ai-composer/referenceLookup";
import { trackEvent } from "@/lib/analytics";

interface AiWorkspacePageProps {
  editorRef?: RefObject<EditorRef | null>;
}

export function AiWorkspacePage({ editorRef }: AiWorkspacePageProps = {}) {
  const editorFontSize = useSettings((s) => s.editorFontSize);
  const aiWorkspaceScale = editorFontSize / EDITOR_FONT_SIZE_DEFAULT;
  const compactViewport = useCompactViewport(520);

  const {
    composerRef,
    messagesEndRef,
    messagesScrollRef,
    userScrolledUpRef,
    composerFocusToken,
    historyOpen,
    setHistoryOpen,
    isStreaming,
    streamPhase,
    sessions,
    activeSessionId,
    draftContent,
    messages,
    applyingMessageId,
    handleNewSession,
    handleSelectSession,
    deleteSession,
    handleRegenerate,
    switchMessageVersion,
    handleConfirmWrite,
    handleCancelWrite,
    handleOpenResultPage,
    handleSubmit,
    setDraftContent,
  } = useAiWorkspaceState({ editorRef });

  const isAutoScrollingRef = useRef(false);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isAutoScrollingRef.current) return;
      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
      userScrolledUpRef.current = !nearBottom;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messagesScrollRef, userScrolledUpRef]);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      isAutoScrollingRef.current = true;
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, [messages, isStreaming, messagesEndRef, userScrolledUpRef]);

  const handleReferenceAdded = (reference: AiFileReferenceAttrs) => {
    trackEvent("ai_reference_added", {
      feature: "ai",
      action: "reference_add",
      result: "success",
      source: "ai_page",
      reference_source_type: reference.sourceType,
      reference_scope: "workspace_ai_page",
    });
  };

  return (
    <div
      data-ai-workspace-root="true"
      className="relative flex h-full flex-col bg-[hsl(var(--goose-editor-bg))]"
      style={{ zoom: aiWorkspaceScale }}
    >
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={handleNewSession}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <LucideIcons.SquarePen className="h-4 w-4" />
        </button>

        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                historyOpen
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <LucideIcons.History className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="w-[300px] rounded-[16px] border border-border/75 bg-popover p-2 shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
          >
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-foreground/80">历史会话</span>
              {sessions.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sessions.length} 条</span>
              )}
            </div>
            <div className="max-h-[340px] overflow-y-auto scrollbar-hide">
              <AiSessionHistoryPanel
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={deleteSession}
                onClose={() => setHistoryOpen(false)}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        ref={messagesScrollRef}
        className="flex-1 overflow-y-auto"
        style={compactViewport ? { paddingBottom: 132 } : undefined}
      >
        <div className="mx-auto w-full max-w-[760px] py-2">
          <AiWorkspaceMessages
            messages={messages}
            isStreaming={isStreaming}
            streamPhase={streamPhase}
            applyingMessageId={applyingMessageId}
            messagesEndRef={messagesEndRef}
            onRegenerate={handleRegenerate}
            onSwitchVersion={switchMessageVersion}
            onConfirmWrite={(messageId, artifact) => {
              void handleConfirmWrite(messageId, artifact);
            }}
            onCancelWrite={handleCancelWrite}
            onOpenResultPage={handleOpenResultPage}
          />
        </div>
      </div>

      <div
        className={
          compactViewport
            ? "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[hsl(var(--goose-editor-bg))] via-[hsl(var(--goose-editor-bg))]/95 to-transparent pt-4"
            : undefined
        }
      >
        <AiPromptComposer
          composerRef={composerRef}
          composerFocusToken={composerFocusToken}
          isStreaming={isStreaming}
          draftContent={draftContent}
          onSubmit={(params) => {
            void handleSubmit(params);
          }}
          onDraftChange={setDraftContent}
          onReferenceAdded={handleReferenceAdded}
        />
      </div>
    </div>
  );
}
