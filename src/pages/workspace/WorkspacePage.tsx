import "./styles/index.css";
import { CommandPalette } from "./components/command/CommandPalette";
import { Editor } from "./components/editor/Editor";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { PageHeader } from "./components/page/PageHeader";
import { IconSelector } from "./components/shared/IconSelector";
import { AiWorkspacePage } from "./components/ai/AiWorkspacePage";
import {
  OPEN_AI_WORKSPACE_EVENT,
  type OpenAiWorkspaceDetail,
} from "./components/ai/events";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { AIFeatureNotice } from "./components/AIFeatureNotice";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";

function normalizeShortcutToken(raw: string) {
  const token = raw.trim().toLowerCase();
  if (!token) return "";
  if (
    token === "mod" ||
    token === "cmdorctrl" ||
    token === "cmdorcontrol" ||
    token === "commandorcontrol"
  ) {
    return isMacPlatform() ? "meta" : "ctrl";
  }
  if (token === "control" || token === "ctrl") return "ctrl";
  if (token === "meta" || token === "command" || token === "cmd") return "meta";
  if (token === "alt" || token === "option") return "alt";
  if (token === "shift") return "shift";
  if (token === "escape" || token === "esc") return "escape";
  if (token.length === 1) return token;
  return token;
}

function isModifierToken(token: string) {
  return token === "ctrl" || token === "meta" || token === "alt" || token === "shift";
}

function matchShortcut(event: KeyboardEvent, shortcut: string) {
  const trimmed = shortcut.trim();
  if (!trimmed) return false;

  const parts = trimmed
    .split("+")
    .map(normalizeShortcutToken)
    .filter(Boolean);
  if (parts.length === 0) return false;

  const expectedModifiers = {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };

  if (
    event.ctrlKey !== expectedModifiers.ctrl ||
    event.metaKey !== expectedModifiers.meta ||
    event.altKey !== expectedModifiers.alt ||
    event.shiftKey !== expectedModifiers.shift
  ) {
    return false;
  }

  const keyToken = parts.find((part) => !isModifierToken(part));
  const eventKey = normalizeShortcutToken(event.key);

  if (!keyToken) {
    return isModifierToken(eventKey) && expectedModifiers[eventKey as keyof typeof expectedModifiers];
  }

  return !isModifierToken(eventKey) && eventKey === keyToken;
}

const DEFAULT_RANDOM_PAGE_EMOJIS = [
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

export function WorkspacePage() {
  const { activePageId, updatePage, getPage, setActivePage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const { openTabs, activeTabId, closeTab, setActiveTab } = useTabs();
  const { globalEditorFullWidth, closeTabShortcut, ai } = useSettings();

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
  const lastViewedPageIdRef = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAiPageOpen, setIsAiPageOpen] = useState(false);
  const dragCounter = useRef(0);

  const isExternalFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes("Files");

  useEffect(() => {
    document.documentElement.classList.add("is-utools");
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
                  const currentTabId = useTabs.getState().activeTabId;
                  if (currentTabId) {
                    useTabs.getState().closeTab(currentTabId);
                  } else {
                    usePages.getState().setActivePage(null);
                  }
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

  const closeCurrentTab = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
      return;
    }
    setActivePage(null);
  }, [activeTabId, closeTab, setActivePage]);

  useEffect(() => {
    const handleCloseTabShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!matchShortcut(event, closeTabShortcut)) return;

      const target = event.target as HTMLElement | null;
      const isInInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInInput) return;

      event.preventDefault();
      closeCurrentTab();
    };

    document.addEventListener("keydown", handleCloseTabShortcut);
    return () => {
      document.removeEventListener("keydown", handleCloseTabShortcut);
    };
  }, [closeCurrentTab, closeTabShortcut]);

  useEffect(() => {
    const handleSwitchTabByNumber = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const code = event.code;
      let targetIndex = -1;
      if (code === "Digit0") {
        targetIndex = 9;
      } else if (/^Digit[1-9]$/.test(code)) {
        targetIndex = Number(code.slice(-1)) - 1;
      } else {
        return;
      }

      const targetTab = openTabs[targetIndex];
      if (!targetTab) return;

      event.preventDefault();
      setActiveTab(targetTab.id);
    };

    document.addEventListener("keydown", handleSwitchTabByNumber);
    return () => {
      document.removeEventListener("keydown", handleSwitchTabByNumber);
    };
  }, [openTabs, setActiveTab]);

  useEffect(() => {
    const handleOpenAiWorkspace = (event: Event) => {
      const customEvent = event as CustomEvent<OpenAiWorkspaceDetail>;
      if (!useSettings.getState().ai.enabled) {
        toast.error("请先在设置中启用 AI 助手");
        return;
      }

      if (!usePages.getState().activePageId) {
        toast("请先打开一个页面，再进入 AI 页面");
        return;
      }

      setIsAiPageOpen(true);
      trackEvent("ai_page_opened", {
        feature: "ai",
        action: "open_page",
        result: "success",
        source: customEvent.detail?.source ?? "header",
      });
    };

    window.addEventListener(
      OPEN_AI_WORKSPACE_EVENT,
      handleOpenAiWorkspace as EventListener,
    );

    return () => {
      window.removeEventListener(
        OPEN_AI_WORKSPACE_EVENT,
        handleOpenAiWorkspace as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!activePageId || !page) {
      setIsAiPageOpen(false);
      lastViewedPageIdRef.current = null;
      return;
    }

    if (lastViewedPageIdRef.current && lastViewedPageIdRef.current !== activePageId) {
      setIsAiPageOpen(false);
    }

    lastViewedPageIdRef.current = activePageId;
  }, [activePageId, page]);

  useEffect(() => {
    if (!ai.enabled) {
      setIsAiPageOpen(false);
    }
  }, [ai.enabled]);

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
        <AIFeatureNotice />
        <div className="workspace-stage">
          <Sidebar
            className="workspace-sidebar-pane"
            disableResize={false}
          />

          <main className="workspace-main-sheet relative flex-1 flex flex-col h-full overflow-hidden">
            {activePageId && page ? (
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
                      await usePages.getState().permanentlyDeletePage(deletedPageId);
                      if (usePages.getState().getPage(deletedPageId)) return;
                      useTabs
                        .getState()
                        .removeDeletedPage(deletedPageId);
                    })();
                  }}
                />

                <div className="workspace-editor-surface relative ml-0 mr-2 mt-0 mb-2 flex-1 overflow-hidden">
                  {isAiPageOpen ? (
                    <AiWorkspacePage page={page} />
                  ) : (
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
                                    scope="file"
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "ml-6 flex h-auto w-auto items-center justify-center p-0 transition-all duration-300",
                                        page.icon && "[&_svg]:!size-[5.25rem] [&_svg]:stroke-[2.2]",
                                        page.icon
                                          ? "opacity-100 scale-100"
                                          : page.trashedAt || page.isLocked
                                            ? "opacity-0"
                                            : isNewPage
                                              ? "opacity-100 animate-slow-pulse hover:scale-105"
                                              : "opacity-0 group-hover:opacity-100 hover:scale-105",
                                      )}
                                      onClick={() => {
                                        if (
                                          !isNewPage ||
                                          page.icon ||
                                          page.trashedAt ||
                                          page.isLocked
                                        ) {
                                          return;
                                        }

                                        const randomEmoji =
                                          DEFAULT_RANDOM_PAGE_EMOJIS[
                                            Math.floor(
                                              Math.random() *
                                                DEFAULT_RANDOM_PAGE_EMOJIS.length,
                                            )
                                          ];
                                        updatePage(activePageId, {
                                          icon: randomEmoji,
                                        });
                                      }}
                                    >
                                      {page.icon ? (
                                        <div className="flex items-center justify-center h-24 w-24 text-8xl">
                                          {(LucideIcons as any)[page.icon] ? (
                                            (() => {
                                              const Icon = (LucideIcons as any)[
                                                page.icon
                                              ];
                                              return (
                                                <Icon className="h-full w-full" />
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
                  )}
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
