import "./styles/index.css";
import { CommandPalette } from "./components/command/CommandPalette";
import { Editor } from "./components/editor/Editor";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { PageHeader } from "./components/page/PageHeader";
import { PageTrashBanner } from "./components/page/PageTrashBanner";
import { IconSelector } from "./components/shared/IconSelector";
import * as LucideIcons from "lucide-react";

export function WorkspacePage() {
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
    default: "DM Sans",
    serif: "仓耳今楷",
    mono: "DM Mono",
  };

  useEffect(() => {
    if (UToolsAdapter.isUTools) {
      document.documentElement.classList.add("is-utools");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const baseFontSize = UToolsAdapter.isUTools ? 14 : 16;
    const fontSizeMap = {
      small: baseFontSize - 2,
      normal: baseFontSize,
      large: baseFontSize + 2,
    };
    root.style.setProperty("--ui-font-size", `${fontSizeMap[uiFontSize]}px`);
    root.style.fontSize = `${fontSizeMap[uiFontSize]}px`;
  }, [uiFontSize]);

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
      `"${fontDefault}", "DM Sans", "HarmonyOS Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
    );
    root.style.setProperty(
      "--font-serif",
      `"${fontSerif}", "仓耳今楷", Georgia, Cambria, "Times New Roman", Times, serif`,
    );
    root.style.setProperty(
      "--font-mono",
      `"${fontMono}", "DM Mono", "HarmonyOS Sans SC", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
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

  useEffect(() => {
    if (activePageId && scrollContainerRef.current) {
      const savedScroll = sessionStorage.getItem(`scroll-${activePageId}`);
      if (savedScroll) {
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

  useEffect(() => {
    if (!UToolsAdapter.isUTools || !UToolsAdapter.supportsSublist) return;

    if (utools.globalSearchEnabled) {
      UToolsAdapter.setSublistFn((keyword: string) => {
        if (!keyword.trim()) return [];

        const query = keyword.toLowerCase();
        const results = Object.values(pages)
          .filter((p) => !p.trashedAt)
          .filter((p) => {
            const title = extractTitleFromContent(p.content);
            const titleMatch = title.toLowerCase().includes(query);
            const contentText = extractTextFromContent(p.content);
            const contentMatch = contentText.toLowerCase().includes(query);
            return titleMatch || contentMatch;
          })
          .slice(0, 5);

        return results.map((p) => ({
          title: extractTitleFromContent(p.content),
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
          {activePageId && page ? (
            <div className="py-12 px-8 min-h-screen">
              <div
                className={cn(
                  "mb-8",
                  page.isFullWidth ? "max-w-full" : "max-w-3xl mx-auto",
                )}
              >
                <div className="group relative mb-4">
                  <IconSelector
                    value={page.icon}
                    onChange={(icon) =>
                      !page.trashedAt &&
                      !page.isLocked &&
                      updatePage(activePageId, { icon })
                    }
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
              </div>

              <Editor editable={!page.isLocked && !page.trashedAt} />
            </div>
          ) : (
            <PageEmptyState />
          )}
        </div>
      </main>
    </div>
  );
}
