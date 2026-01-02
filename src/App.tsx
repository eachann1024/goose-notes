import { Editor } from "@/components/Editor";
import { Sidebar } from "@/components/Sidebar";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { cn } from "@/lib/utils";
import { PageMenu } from "@/components/PageMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { IconSelector } from "@/components/IconSelector";
import { UToolsAdapter } from "@/lib/utools";
import { extractTextFromContent } from "@/lib/content-text-extractor";
import * as LucideIcons from "lucide-react";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { getRandomTip } from "@/lib/tips";

function App() {
  const { activePageId, getPage, updatePage, pages, setActivePage } =
    usePages();
  const {
    utools,
    customFonts,
    uiFontSize,
    editorFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    resetEditorFontSize,
  } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const defaultFonts = {
    default: "Inter",
    serif: "Source Serif 4",
    mono: "JetBrains Mono",
  };

  // 在 uTools 环境下添加类名，便于 CSS 针对性调整
  useEffect(() => {
    if (UToolsAdapter.isUTools) {
      document.documentElement.classList.add("is-utools");
    }
  }, []);

  // 应用 UI 字体大小
  useEffect(() => {
    const root = document.documentElement;
    // 基础字体大小：uTools 默认 14px，Web 默认 16px
    const baseFontSize = UToolsAdapter.isUTools ? 14 : 16;
    const fontSizeMap = {
      small: baseFontSize - 2,
      normal: baseFontSize,
      large: baseFontSize + 2,
    };
    root.style.setProperty("--ui-font-size", `${fontSizeMap[uiFontSize]}px`);
    root.style.fontSize = `${fontSizeMap[uiFontSize]}px`;
  }, [uiFontSize]);

  // 应用编辑器字体大小
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${editorFontSize}px`,
    );
  }, [editorFontSize]);

  useEffect(() => {
    const root = document.documentElement;
    const fontDefault = customFonts.default.font || defaultFonts.default;
    const fontSerif = customFonts.serif.font || defaultFonts.serif;
    const fontMono = customFonts.mono.font || defaultFonts.mono;

    root.style.setProperty(
      "--font-default",
      `"${fontDefault}", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
    );
    root.style.setProperty(
      "--font-serif",
      `"${fontSerif}", "Source Serif 4", Georgia, Cambria, "Times New Roman", Times, serif`,
    );
    root.style.setProperty(
      "--font-mono",
      `"${fontMono}", "JetBrains Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
    );
  }, [customFonts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "s") {
          e.preventDefault();
        } else if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          increaseEditorFontSize();
        } else if (e.key === "-") {
          e.preventDefault();
          decreaseEditorFontSize();
        } else if (e.key === "0") {
          e.preventDefault();
          resetEditorFontSize();
        }
      }
    };

    // 全局禁用系统右键菜单
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [increaseEditorFontSize, decreaseEditorFontSize, resetEditorFontSize]);

  // 页面切换时恢复滚动位置
  useEffect(() => {
    if (activePageId && scrollContainerRef.current) {
      const savedScroll = sessionStorage.getItem(`scroll-${activePageId}`);
      if (savedScroll) {
        // 延迟恢复，等待内容渲染，使用 instant 避免滚动动画
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo({
            top: Number(savedScroll),
            behavior: "instant",
          });
        });
      } else {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
      }
    }
  }, [activePageId]);

  // 滚动时保存位置（防抖）
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activePageId) return;

    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem(
          `scroll-${activePageId}`,
          String(container.scrollTop),
        );
      }, 150);
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timer);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [activePageId]);

  // 初始化 uTools 全局搜索
  useEffect(() => {
    if (!UToolsAdapter.isUTools || !UToolsAdapter.supportsSublist) return;

    if (utools.globalSearchEnabled) {
      UToolsAdapter.setSublistFn((keyword: string) => {
        if (!keyword.trim()) return [];

        const query = keyword.toLowerCase();
        const results = Object.values(pages)
          .filter((p) => !p.trashedAt)
          .filter((p) => {
            const titleMatch = p.title.toLowerCase().includes(query);
            const contentText = extractTextFromContent(p.content);
            const contentMatch = contentText.toLowerCase().includes(query);
            return titleMatch || contentMatch;
          })
          .slice(0, 5); // 限制结果数量

        return results.map((p) => ({
          title: p.title || "无标题",
          description: new Date(p.updatedAt).toLocaleString(),
          icon: "./logo.png",
          url: `goose-note://page/${p.id}`,
        }));
      });
    } else {
      UToolsAdapter.removeSublistFn();
    }

    return () => {
      UToolsAdapter.removeSublistFn();
    };
  }, [pages, utools.globalSearchEnabled]);

  // 监听 uTools sublist 导航事件
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ pageId: string }>;
      setActivePage(customEvent.detail.pageId);
    };

    window.addEventListener("goose-note:navigate", handleNavigate);
    return () => {
      window.removeEventListener("goose-note:navigate", handleNavigate);
    };
  }, [setActivePage]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Toast 容器 - Notion 风格 */}
      <Toaster
        position="top-center"
        duration={3000}
        visibleToasts={1}
        theme="dark"
        toastOptions={{
          style: {
            borderRadius: "6px",
            fontSize: "14px",
            padding: "12px 16px",
          },
        }}
      />

      <CommandPalette />
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* 垃圾箱页面预览提示横幅 */}
        {activePageId && page?.trashedAt && (
          <div className="bg-amber-500/90 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-4 shrink-0">
            <span className="flex items-center gap-2">
              <LucideIcons.Trash2 className="h-4 w-4" />
              此页面在垃圾箱中
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  usePages.getState().restorePage(activePageId);
                }}
                className="px-3 py-1 bg-amber-950/20 hover:bg-amber-950/30 rounded text-xs transition-colors"
              >
                恢复页面
              </button>
              <button
                onClick={() => {
                  usePages.getState().permanentlyDeletePage(activePageId);
                }}
                className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs transition-colors"
              >
                永久删除
              </button>
            </div>
          </div>
        )}

        {/* Top Header (Notion-like) */}
        {activePageId && page && (
          <div className="h-12 flex items-center justify-between px-3 border-b bg-background sticky top-0 z-10 shrink-0">
            <div className="flex items-center text-sm text-muted-foreground gap-2 overflow-hidden">
              {/* Breadcrumbs or Page Title */}
              <span className="truncate max-w-[200px]">
                {page.title || "无标题"}
              </span>
              {page.isLocked && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  已锁定
                </span>
              )}
              {page.trashedAt && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded">
                  只读
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => usePages.getState().setActivePage(null)}
                className="p-1 hover:bg-muted rounded text-muted-foreground/70 hover:text-foreground transition-colors"
                title="关闭页面"
              >
                <LucideIcons.X className="h-4 w-4" />
              </button>

              <button
                onClick={() =>
                  updatePage(activePageId, { isFavorite: !page.isFavorite })
                }
                className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground/70 hover:text-foreground"
                title={page.isFavorite ? "取消收藏" : "收藏页面"}
              >
                <LucideIcons.Star
                  className={cn(
                    "h-4 w-4 transition-colors",
                    page.isFavorite
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/70",
                  )}
                />
              </button>

              {!page.trashedAt && <PageMenu />}
            </div>
          </div>
        )}

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {activePageId && page ? (
            <div className="py-12 px-8 min-h-screen">
              {/* Page Title Input */}
              <div
                className={cn(
                  "mb-8 px-8",
                  page.isFullWidth ? "max-w-full" : "max-w-3xl mx-auto",
                )}
              >
                {/* Icon */}
                <div className="group relative mb-4">
                  <IconSelector
                    value={page.icon}
                    onChange={(icon) => updatePage(activePageId, { icon })}
                  >
                    <button
                      className={cn(
                        "flex items-center justify-center transition-opacity",
                        page.icon
                          ? "opacity-100"
                          : "opacity-0 hover:opacity-100",
                      )}
                    >
                      {page.icon ? (
                        <div className="flex items-center justify-center h-16 w-16 text-6xl">
                          {/* Check if it's an emoji (not in Lucide) or Lucide Icon */}
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

                <input
                  type="text"
                  placeholder="无标题"
                  className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                  value={page.title}
                  onChange={(e) =>
                    updatePage(activePageId, { title: e.target.value })
                  }
                  disabled={page.isLocked || !!page.trashedAt}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      window.dispatchEvent(
                        new CustomEvent("goose-note:focus-editor-start"),
                      );
                    }
                  }}
                />
                {/*<p className="text-xs text-muted-foreground/60 mt-1">
                  最后编辑于 {new Date(page.updatedAt).toLocaleString("zh-CN")}
                </p>*/}
              </div>

              <Editor editable={!page.isLocked && !page.trashedAt} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-start pt-16 text-muted-foreground bg-background overflow-y-auto">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                准备好记录想法了吗？
              </h2>
              <p className="text-base opacity-60 mb-8">
                点击左侧侧边栏新建页面，或选择现有页面开始。
              </p>

              <div className="w-full max-w-6xl px-12 pb-12 flex flex-col items-center justify-start">
                <img
                  src={
                    "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/welcome-cover.png"
                  }
                  alt="Welcome"
                  className="w-full h-auto max-h-[50vh] object-contain opacity-90"
                />
                <p className="text-sm text-muted-foreground/60 mt-4">
                  💡 {getRandomTip()}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
