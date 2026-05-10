import { useEffect, useState, useCallback, useRef } from "react";
import { useStickyNote } from "@/stores/useStickyNote";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { StickyNoteSelector } from "./StickyNoteSelector";
import { StickyNoteToolbar } from "./StickyNoteToolbar";
import { Editor } from "@/pages/workspace/components/editor/Editor";
import { getPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export function StickyNotePage() {
  const { active, pageId, close, selectPage } = useStickyNote();
  const { pages, getPage, updatePage } = usePages();
  const { notebooks } = useNotebooks();
  const { openTab } = useTabs();
  const [isClosing, setIsClosing] = useState(false);

  const page = pageId ? getPage(pageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const isLocalFolderPage = notebook?.source === "local-folder";

  useEffect(() => {
    if (active) {
      trackEvent("sticky_note_opened", {
        feature: "sticky_note",
        action: "open",
        result: "success",
      });
    }
  }, [active]);

  useEffect(() => {
    if (!pageId) return;
    trackEvent("sticky_note_page_selected", {
      feature: "sticky_note",
      action: "select_page",
      page_id: pageId,
      source_type: page?.localFilePath ? "local-file" : "app-page",
    });
  }, [pageId]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      close();
      setIsClosing(false);
      trackEvent("sticky_note_closed", {
        feature: "sticky_note",
        action: "close",
      });
    }, 200);
  }, [close]);

  const handleOpenInWorkspace = useCallback(() => {
    if (!pageId) return;
    trackEvent("sticky_note_open_in_workspace", {
      feature: "sticky_note",
      action: "open_in_workspace",
      page_id: pageId,
      source_type: page?.localFilePath ? "local-file" : "app-page",
    });
    openTab(pageId);
    handleClose();
  }, [pageId, page, openTab, handleClose]);

  const handleSelectPage = useCallback(
    (id: string) => {
      selectPage(id);
    },
    [selectPage],
  );

  // 记录便签使用时长
  const openTimeRef = useRef<number>(0);
  useEffect(() => {
    if (active && pageId) {
      openTimeRef.current = Date.now();
    }
    return () => {
      if (openTimeRef.current > 0) {
        const duration = Date.now() - openTimeRef.current;
        trackEvent("sticky_note_duration", {
          feature: "sticky_note",
          action: "duration",
          duration_ms: duration,
          page_id: pageId,
        });
        openTimeRef.current = 0;
      }
    };
  }, [active, pageId]);

  // 监听编辑器交互（判断用户是否实际编辑）
  useEffect(() => {
    if (!active || !pageId) return;
    let hasInteracted = false;
    const handleEditorInteraction = () => {
      if (hasInteracted) return;
      hasInteracted = true;
      trackEvent("sticky_note_editor_interacted", {
        feature: "sticky_note",
        action: "editor_interacted",
        page_id: pageId,
      });
    };
    window.addEventListener("goose-note:editor-interacted", handleEditorInteraction);
    return () => {
      window.removeEventListener("goose-note:editor-interacted", handleEditorInteraction);
    };
  }, [active, pageId]);

  // ESC 关闭便签模式
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, handleClose]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-[hsl(var(--goose-editor-bg))]",
        isClosing && "animate-out fade-out duration-200",
      )}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <LucideIcons.StickyNote className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium truncate">
            {page ? getPageTitle(page) || "无标题" : "便签模式"}
          </span>
          {notebook && (
            <span className="text-xs text-muted-foreground truncate">
              · {notebook.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pageId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenInWorkspace}
              title="在工作区打开"
            >
              <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            title="关闭"
          >
            <LucideIcons.X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden relative">
        {!pageId ? (
          <StickyNoteSelector onSelect={handleSelectPage} />
        ) : page ? (
          <div className="h-full overflow-y-auto page-scroll-container">
            <div className="px-4 py-3 pb-20">
              {/* 便签样式背景 */}
              <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-4 min-h-[200px]">
                <Editor
                  editable={!page.isLocked && !page.trashedAt}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <LucideIcons.FileX className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">笔记不存在或已被删除</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部工具栏 */}
      {pageId && page && (
        <StickyNoteToolbar
          page={page}
          pageId={pageId}
          onClose={handleClose}
          onSwitchPage={() => selectPage("")}
          onOpenInWorkspace={handleOpenInWorkspace}
        />
      )}
    </div>
  );
}
