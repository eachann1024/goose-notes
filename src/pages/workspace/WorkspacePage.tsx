import "./styles/index.css";
import { CommandPalette } from "./components/command/CommandPalette";
import { Editor } from "./components/editor/Editor";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { PageHeader } from "./components/page/PageHeader";
import { PageTrashBanner } from "./components/page/PageTrashBanner";
import { IconSelector } from "./components/shared/IconSelector";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";

export function WorkspacePage() {
  const { activePageId, updatePage, getPage } = usePages();
  const { activeNotebookId } = useNotebooks();

  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalFolderPage = notebook?.source === "local-folder";
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const isExternalFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes("Files");

  // 当活跃页面在回收站时，自动清空 activePageId 显示空白状态
  useEffect(() => {
    if (page?.trashedAt && activePageId) {
      usePages.getState().setActivePage(null);
    }
  }, [page?.trashedAt, activePageId]);

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
        const filePath = `${dirPath}/${filename}`;

        // 处理文件/文件夹删除或移动
        if (eventType === "rename") {
          // 如果路径不再存在，说明是删除或移出
          if (!(window as any).gooseFs.exists(filePath)) {
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
                usePages.getState().setActivePage(null);
              }
            }
            // 重新加载侧边栏以同步状态
            if (notebook.id && notebook.localPath) {
              usePages
                .getState()
                .loadLocalFolderPages(notebook.id, notebook.localPath);
            }
            return;
          }
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

      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(
          `本地 - ${folderPath.split("/").pop() || "Unknown"}`,
          folderPath,
        );
      usePages.getState().loadLocalFolderPages(notebookId, folderPath);
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
        className="flex h-screen overflow-hidden bg-background text-foreground"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-background/90 via-background/95 to-background/90 backdrop-blur-sm animate-in fade-in duration-300">
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
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {activePageId && page?.trashedAt && (
          <PageTrashBanner
            onRestore={() => usePages.getState().restorePage(activePageId)}
            onDelete={() =>
              usePages.getState().permanentlyDeletePage(activePageId)
            }
          />
        )}

        {activePageId && page && (
          <PageHeader
            page={page}
            onClose={() => usePages.getState().setActivePage(null)}
            onToggleFavorite={() =>
              updatePage(activePageId, { isFavorite: !page.isFavorite })
            }
          />
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto page-scroll-container"
        >
          {activePageId && page ? (() => {
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
                  "px-8 min-h-screen",
                  page.icon ? "pb-12 pt-4" : "pt-0 pb-12",
                )}
              >
                <div
                  className={cn(
                    page.icon ? "mb-4 mt-4" : "mt-4",
                    page.isFullWidth ? "max-w-full" : "max-w-3xl mx-auto",
                  )}
                >
                  {!isLocalFolderPage && (
                    <div className={cn(
                      "group relative mb-4",
                      !page.icon && "min-h-[40px]"
                    )}>
                      <IconSelector
                        value={page.icon}
                        onChange={(icon) =>
                          !page.trashedAt &&
                          !page.isLocked &&
                          updatePage(activePageId, { icon })
                        }
                        onFirstOpen={() => {
                          if (!page.icon) {
                            const defaultEmojis = ["📝", "📄", "📋", "📌", "🎯", "💡", "⭐", "🔖", "📚", "✨"];
                            const randomEmoji = defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
                            updatePage(activePageId, { icon: randomEmoji });
                          }
                        }}
                      >
                        <button
                          className={cn(
                            "flex items-center justify-center transition-all duration-300 ml-6",
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
                                  const Icon = (LucideIcons as any)[page.icon];
                                  return <Icon className="h-14 w-14" />;
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
                        </button>
                      </IconSelector>
                    </div>
                  )}
                </div>

                <Editor editable={!page.isLocked && !page.trashedAt} />
              </div>
            );
          })() : (
            <PageEmptyState />
          )}
        </div>
      </main>
    </div>
    </>
  );
}
