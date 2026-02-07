import "./styles/index.css";
import { CommandPalette } from "./components/command/CommandPalette";
import { Editor } from "./components/editor/Editor";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { PageHeader } from "./components/page/PageHeader";
import { IconSelector } from "./components/shared/IconSelector";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";

export function WorkspacePage() {
  const { activePageId, updatePage, getPage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const { globalEditorFullWidth } = useSettings();

  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;
  const pageNotebook = page ? notebooks[page.workspaceId] : undefined;
  const isLocalFolderPage = pageNotebook?.source === "local-folder";
  const isEditorFullWidth = Boolean(
    pageNotebook?.editorFullWidth ?? globalEditorFullWidth,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageScrollPositionsRef = useRef<Record<string, number>>({});
  const lastActivePageRef = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const isExternalFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes("Files");

  useEffect(() => {
    if (UToolsAdapter.isUTools) {
      document.documentElement.classList.add("is-utools");
    }
  }, []);

  // 监听本地文件变更
  useEffect(() => {
    const handleFileChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventType, filename, dirPath } = customEvent.detail;
      if (
        notebook?.source === "local-folder" &&
        notebook.localPath === dirPath
      ) {
        const gooseFs = (window as any).gooseFs as GooseFs | undefined;
        if (!gooseFs) return;
        const filePath = `${dirPath}/${filename}`;

        // 处理文件/文件夹删除或移动
        if (eventType === "rename") {
          void (async () => {
            const exists = gooseFs.existsAsync
              ? await gooseFs.existsAsync(filePath)
              : gooseFs.exists(filePath);

            // 如果路径不再存在，说明是删除或移出
            if (!exists) {
              // 如果删除的是当前活跃页面，或者是当前页面的父级目录
              if (activePageId && page?.localFilePath) {
                const isCurrentFile = page.localFilePath === filePath;
                const isParentDir =
                  page.localFilePath.startsWith(
                    filePath +
                      (filePath.endsWith("/") || filePath.endsWith("\\")
                        ? ""
                        : "/"),
                  ) || page.localFilePath.startsWith(filePath + "\\");

                if (isCurrentFile || isParentDir) {
                  useTabs.getState().closeTab(activePageId);
                }
              }
              // 重新加载侧边栏以同步状态
              if (notebook.id && notebook.localPath) {
                usePages
                  .getState()
                  .loadLocalFolderPages(notebook.id, notebook.localPath);
              }
            }
          })();
        }
      }
    };

    window.addEventListener("goose-note:file-changed", handleFileChange);
    return () => {
      window.removeEventListener("goose-note:file-changed", handleFileChange);
    };
  }, [notebook, activePageId, page]);

  // 启动/停止本地文件夹监听
  useEffect(() => {
    if (
      notebook?.source === "local-folder" &&
      notebook.localPath &&
      (window as any).gooseFs
    ) {
      // 启动监听
      (window as any).gooseFs.watch(
        notebook.localPath,
        (_eventType: string, _filename: string) => {
          // 监听逻辑已在上面的 useEffect 中处理
        },
      );
    }

    return () => {
      // 清理监听
      if (notebook?.localPath && (window as any).gooseFs) {
        (window as any).gooseFs.unwatch(notebook.localPath);
      }
    };
  }, [notebook?.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentPageId = usePages.getState().activePageId;
      if (!currentPageId) return;
      pageScrollPositionsRef.current[currentPageId] = container.scrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [activePageId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const previousPageId = lastActivePageRef.current;

    if (previousPageId && container) {
      pageScrollPositionsRef.current[previousPageId] = container.scrollTop;
    }

    lastActivePageRef.current = activePageId;

    if (!activePageId || !container) return;

    const savedTop = pageScrollPositionsRef.current[activePageId];
    const targetTop = typeof savedTop === "number" ? savedTop : 0;

    const restoreScroll = () => {
      const currentContainer = scrollContainerRef.current;
      if (!currentContainer) return;
      currentContainer.scrollTop = targetTop;
    };

    requestAnimationFrame(restoreScroll);
    const timer = window.setTimeout(restoreScroll, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePageId]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExternalFileDrag(e)) return;
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExternalFileDrag(e)) return;
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExternalFileDrag(e)) return;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExternalFileDrag(e)) return;
    setIsDragging(false);
    dragCounter.current = 0;

    const items = Array.from(e.dataTransfer.items);
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (!entry || !entry.isDirectory) continue;

      const file = item.getAsFile?.();
      const folderPath =
        file && typeof (file as any).path === "string"
          ? (file as any).path
          : null;
      if (!folderPath) continue;

      const folderName = folderPath.split(/[\\/]/).pop() || "Unknown";
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(folderName, folderPath);
      await usePages
        .getState()
        .loadLocalFolderPages(notebookId, folderPath, { showWelcome: true });
      toast.success("文件夹已打开");
      return;
    }
  };

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
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-[1px] animate-in fade-in duration-300">
            <div className="text-center">
              <LucideIcons.FolderOpen className="h-20 w-20 mx-auto mb-4 text-muted-foreground/80" />
              <p className="text-lg text-muted-foreground font-medium">
                拖放文件夹以打开
              </p>
              <p className="text-sm text-muted-foreground/60 mt-2">
                支持 .md / .markdown 文件
              </p>
            </div>
          </div>
        )}
        <CommandPalette />
        <div className="workspace-stage">
          <Sidebar
            className="workspace-sidebar-pane"
            disableResize={isEditorFullWidth && !UToolsAdapter.isUTools}
          />

          <main className="workspace-main-sheet relative flex-1 flex flex-col h-full overflow-hidden">
            {activePageId && page ? (
              <>
                <PageHeader
                  page={page}
                  onClose={() => {
                    if (!activePageId) return;
                    if (UToolsAdapter.isUTools) {
                      usePages.getState().setActivePage(null);
                      return;
                    }
                    useTabs.getState().closeTab(activePageId);
                  }}
                  onToggleFavorite={() =>
                    updatePage(activePageId, { isFavorite: !page.isFavorite })
                  }
                  onRestore={() =>
                    usePages.getState().restorePage(activePageId)
                  }
                  onDelete={() => {
                    useTabs.getState().removeDeletedPage(activePageId);
                    void usePages.getState().permanentlyDeletePage(activePageId);
                  }}
                />

                <div className="workspace-editor-surface relative ml-0 mr-2 mt-0 mb-2 flex-1 overflow-hidden">
                  <div
                    ref={scrollContainerRef}
                    className="h-full overflow-y-auto page-scroll-container bg-[hsl(var(--goose-editor-bg))]"
                  >
                    {(() => {
                      // 判断是否是新页面（创建时间等于更新时间且内容为空）
                      const isNewPage =
                        page.createdAt === page.updatedAt &&
                        (!page.content?.content?.[1]?.content ||
                          page.content.content[1].content.length === 0);

                      // 判断是否有实际内容（除了标题行之外还有内容）
                      const hasRealContent =
                        page.content?.content &&
                        page.content.content.length > 2;

                      return (
                        <div
                          className={cn(
                            "min-h-screen",
                            isEditorFullWidth
                              ? "px-6 md:px-8 lg:px-10"
                              : "px-8",
                            page.icon ? "pb-12 pt-4" : "pt-0 pb-12",
                          )}
                        >
                          <div
                            className={cn(
                              page.icon ? "mb-3 mt-2" : "mt-1",
                              isEditorFullWidth
                                ? "max-w-full"
                                : "max-w-3xl mx-auto",
                            )}
                          >
                            {!isLocalFolderPage && (
                              <div
                                className={cn(
                                  "group relative mb-2",
                                  !page.icon && "min-h-[20px]",
                                )}
                              >
                                <IconSelector
                                  value={page.icon}
                                  onChange={(icon) =>
                                    !page.trashedAt &&
                                    !page.isLocked &&
                                    updatePage(activePageId, { icon })
                                  }
                                  onFirstOpen={() => {
                                    if (!page.icon) {
                                      const defaultEmojis = [
                                        "📝",
                                        "📄",
                                        "📋",
                                        "📌",
                                        "🎯",
                                        "💡",
                                        "⭐",
                                        "🔖",
                                        "📚",
                                        "✨",
                                      ];
                                      const randomEmoji =
                                        defaultEmojis[
                                          Math.floor(
                                            Math.random() *
                                              defaultEmojis.length,
                                          )
                                        ];
                                      updatePage(activePageId, {
                                        icon: randomEmoji,
                                      });
                                    }
                                  }}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "ml-6 flex h-auto w-auto items-center justify-center p-0 transition-all duration-300",
                                      page.icon
                                        ? "opacity-100 scale-100"
                                        : page.trashedAt || page.isLocked
                                          ? "opacity-0"
                                          : isNewPage
                                            ? "opacity-100 animate-slow-pulse hover:scale-105"
                                            : "opacity-0 group-hover:opacity-100 hover:scale-105",
                                    )}
                                  >
                                    {page.icon ? (
                                      <div className="flex items-center justify-center h-16 w-16 text-6xl">
                                        {(LucideIcons as any)[page.icon] ? (
                                          (() => {
                                            const Icon = (LucideIcons as any)[
                                              page.icon
                                            ];
                                            return (
                                              <Icon className="h-14 w-14" />
                                            );
                                          })()
                                        ) : (
                                          <span>{page.icon}</span>
                                        )}
                                      </div>
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
                            editable={!page.isLocked && !page.trashedAt}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
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
