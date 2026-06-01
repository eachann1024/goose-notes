import { type RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmLocalDelete } from "@/lib/confirm-local-delete";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { PageHeader } from "./components/page/PageHeader";
import { IconSelector } from "./components/shared/IconSelector";
import { AiWorkspacePage } from "./components/ai/AiWorkspacePage";
import { CommandPalette } from "./components/command/CommandPalette";
import { AIFeatureNotice } from "./components/AIFeatureNotice";
import { Editor, type EditorRef } from "@/components/editor/core/Editor";
import { EditorHostBridge } from "./components/editor-host/EditorHostBridge";
import {
  HistoryToolbar,
  HistoryReader,
} from "./components/history/HistoryView";
import { useHistoryView } from "@/stores/useHistoryView";
import { useTabs } from "@/stores/useTabs";
import { toast } from "sonner";

interface WorkspaceLayoutProps {
  isDragging: boolean;
  dragIntent: "folder" | "text-file" | "file";
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
  isAiPageOpen: boolean;
  setIsAiPageOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  editorRef: RefObject<EditorRef | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export function WorkspaceLayout({
  isDragging,
  dragIntent,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  isAiPageOpen,
  setIsAiPageOpen,
  editorRef,
  scrollContainerRef,
}: WorkspaceLayoutProps) {
  const { activePageId, updatePage, getPage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const { globalEditorFullWidth } = useSettings();
  const historyActivePageId = useHistoryView((s) => s.active);
  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const page = activePageId ? getPage(activePageId) : undefined;
  const pageNotebook = page ? notebooks[page.workspaceId] : undefined;
  const isLocalFolderPage = pageNotebook?.source === "local-folder";
  const isEditorFullWidth = Boolean(
    pageNotebook?.editorFullWidth ?? globalEditorFullWidth,
  );

  return (
    <>
      <style>{`
        @keyframes slow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-slow-pulse {
          animation: slow-pulse 4s ease-in-out infinite;
        }
      `}</style>
      <div
        className="workspace-shell window-shell-safe-top flex overflow-hidden bg-background text-foreground"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="fixed inset-0 z-[25000] flex items-center justify-center bg-[hsl(var(--goose-editor-bg)/0.96)] animate-in fade-in duration-150">
            <div className="flex min-h-[188px] min-w-[312px] flex-col items-center justify-center rounded-[14px] border border-border/70 bg-[hsl(var(--goose-shell-bg)/0.98)] px-10 py-8 text-center shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_42px_rgba(0,0,0,0.32)]">
              {dragIntent === "folder" ? (
                <LucideIcons.FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/80" />
              ) : dragIntent === "text-file" ? (
                <LucideIcons.FileText className="mb-4 h-12 w-12 text-muted-foreground/80" />
              ) : (
                <LucideIcons.FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/70" />
              )}
              <p className="text-base font-medium text-foreground">
                {dragIntent === "folder"
                  ? "松手打开文件夹"
                  : dragIntent === "text-file"
                    ? "松手导入文本文件"
                    : "松手后检查文件"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dragIntent === "folder"
                  ? "会作为本地文件夹记事本载入"
                  : "支持 .md、.markdown、.txt"}
              </p>
            </div>
          </div>
        )}
        <CommandPalette />
        <AIFeatureNotice />
        <div className="workspace-stage">
          <Sidebar
            className="workspace-sidebar-pane"
            disableResize={false}
            selectedPageId={isAiPageOpen ? null : activePageId}
            editorRef={editorRef}
            scrollContainerRef={scrollContainerRef}
            isAiPageOpen={isAiPageOpen}
          />


          <main className="workspace-main-sheet relative flex-1 flex flex-col h-full overflow-hidden">
            {activePageId && page && inHistoryMode ? (
              <>
                <HistoryToolbar />
                <div className="workspace-editor-surface relative ml-0 mt-0 flex-1 min-h-0 overflow-hidden">
                  <div
                    className={cn(
                      "h-full overflow-y-auto page-scroll-container bg-[hsl(var(--goose-editor-bg))]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex min-h-full flex-col pt-0",
                        isEditorFullWidth ? "px-6 md:px-8 lg:px-10" : "px-8",
                      )}
                    >
                      <HistoryReader />
                    </div>
                  </div>
                </div>
              </>
            ) : activePageId && page ? (
              <>
                <PageHeader
                  page={page}
                  isAiPageOpen={isAiPageOpen}
                  onToggleAiPage={() => {
                    setIsAiPageOpen((current) => !current);
                  }}
                  onExitAiPage={() => {
                    setIsAiPageOpen(false);
                  }}
                  onOpenSearch={() => {
                    setIsAiPageOpen(false);
                    window.dispatchEvent(
                      new CustomEvent("goose-note:open-search", {
                        detail: { resetQuery: true, openInNewTab: true },
                      }),
                    );
                  }}
                  onToggleFavorite={() =>
                    updatePage(activePageId, { isFavorite: !page.isFavorite })
                  }
                  onTogglePinned={() =>
                    updatePage(activePageId, { isPinned: !page.isPinned })
                  }
                  onRestore={() => {
                    const result = usePages.getState().restorePage(activePageId);
                    if (!result.ok) return;

                    const parentPath =
                      result.parentTitles && result.parentTitles.length > 0
                        ? result.parentTitles.join(" / ")
                        : "顶层";
                    const restoredChildrenCount = Math.max(
                      (result.restoredCount || 1) - 1,
                      0,
                    );
                    const restoredChildrenText =
                      restoredChildrenCount > 0
                        ? `，并恢复 ${restoredChildrenCount} 个子项`
                        : "";

                    toast.success(
                      `已恢复${result.itemLabel || "页面"}「${result.pageTitle || "无标题"}」`,
                      {
                        description: `位置：${result.notebookName || "未命名记事本"} / ${parentPath}${restoredChildrenText}`,
                      },
                    );
                  }}
                  onDelete={() => {
                    const deletedPageId = activePageId;
                    void (async () => {
                      const targetPage = usePages
                        .getState()
                        .getPage(deletedPageId);
                      const targetNotebook = targetPage
                        ? notebooks[targetPage.workspaceId]
                        : undefined;
                      if (
                        targetPage &&
                        targetNotebook?.source === "local-folder"
                      ) {
                        const ok = await confirmLocalDelete(targetPage);
                        if (!ok) return;
                      }
                      await usePages.getState().permanentlyDeletePage(deletedPageId);
                      if (usePages.getState().getPage(deletedPageId)) return;
                      useTabs
                        .getState()
                        .removeDeletedPage(deletedPageId);
                    })();
                  }}
                />

                <EditorHostBridge
                  page={page}
                  isEditorFullWidth={isEditorFullWidth}
                >
                <div className="workspace-editor-surface relative ml-0 mt-0 flex-1 min-h-0 overflow-hidden">
                  {isAiPageOpen && (
                    <div className="h-full">
                      <AiWorkspacePage editorRef={editorRef} />
                    </div>
                  )}
                  <div
                    ref={scrollContainerRef}
                    className={cn(
                      "h-full overflow-y-auto page-scroll-container bg-[hsl(var(--goose-editor-bg))]",
                      isAiPageOpen && "hidden",
                    )}
                  >
                    {(() => {
                      const isNewPage =
                        page.createdAt === page.updatedAt &&
                        (!page.content?.content?.[1]?.content ||
                          page.content.content[1].content.length === 0);

                      return (
                        <div
                          className={cn(
                            "flex min-h-full flex-col",
                            isEditorFullWidth
                              ? "px-6 md:px-8 lg:px-10"
                              : "px-8",
                            page.icon ? "pt-4" : "pt-0",
                          )}
                        >
                          <div
                            className={cn(
                              page.icon ? "-mb-1 mt-2" : "mt-1",
                              isEditorFullWidth
                                ? "max-w-full"
                                : "w-full max-w-[720px] mx-auto",
                            )}
                          >
                            {!isLocalFolderPage && (
                              <div
                                className={cn(
                                  "group relative",
                                  !page.icon && "min-h-[20px] mb-2",
                                )}
                              >
                                <IconSelector
                                  value={page.icon}
                                  onChange={(icon) =>
                                    !page.trashedAt &&
                                    !page.isLocked &&
                                    updatePage(activePageId, { icon })
                                  }
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "inline-flex h-auto w-auto p-0 items-center justify-start transition-all duration-300",
                                      page.icon
                                        ? "opacity-100 scale-100 [&_svg]:!size-[5.25rem] [&_svg]:stroke-[2.2]"
                                        : page.trashedAt || page.isLocked
                                          ? "opacity-0"
                                          : isNewPage
                                            ? "opacity-100 animate-slow-pulse hover:scale-105"
                                            : "opacity-0 group-hover:opacity-100 hover:scale-105",
                                    )}
                                  >
                                    {page.icon ? (
                                      (LucideIcons as any)[page.icon] ? (
                                        (() => {
                                          const Icon = (LucideIcons as any)[
                                            page.icon
                                          ];
                                          return <Icon />;
                                        })()
                                      ) : (
                                        <span className="text-[5.25rem] leading-none">
                                          {page.icon}
                                        </span>
                                      )
                                    ) : (
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground hover:bg-muted px-2 py-1 rounded-md">
                                        <LucideIcons.Smile className="h-4 w-4" />
                                        <span>添加图标</span>
                                      </div>
                                    )}
                                  </Button>
                                </IconSelector>
                              </div>
                            )}
                          </div>

                          <Editor
                            ref={editorRef}
                            editable={!page.isLocked && !page.trashedAt}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
                </EditorHostBridge>
              </>
            ) : (
              <PageEmptyState />
            )}
          </main>
        </div>
      </div>
    </>
  );
}
