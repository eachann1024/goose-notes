import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PartialBlock } from "@blocknote/core";
import {
  ArchiveRestore,
  Check,
  ChevronDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { EditorSurface } from "./components/EditorSurface";
import { installBrowserBridge } from "./lib/bridge";
import type { BridgeMessage, EditorPagePayload, HostMessage, SaveAcknowledgement } from "./lib/types";
import "./styles/editor.css";
import "./styles/harness.css";

interface HarnessPage {
  id: string;
  title: string;
  icon: string;
  content: PartialBlock[];
  revision: number;
  favorite: boolean;
  trashed: boolean;
}

interface HarnessTab {
  pageID: string;
  preview: boolean;
}

interface HarnessSnapshot {
  version: 1;
  pages: HarnessPage[];
  tabs: HarnessTab[];
  activeID: string | null;
  theme: "light" | "dark";
}

const HARNESS_STORAGE_KEY = "goose-notes.browser-harness.v1";

const initialPages: HarnessPage[] = [
  {
    id: "page-plan",
    title: "五一千岛湖露营 · 两日计划",
    icon: "🏕️",
    revision: 1,
    favorite: true,
    trashed: false,
    content: [
      { type: "paragraph", content: "和小宇、阿楠一行 5 人。把要带的东西、路线和账都记在这一页。" },
      { type: "heading", props: { level: 2 }, content: "出发前" },
      { type: "bulletListItem", content: "炭、喷枪、防风打火机" },
      { type: "bulletListItem", content: "饮用水两大桶和一箱气泡水" },
      { type: "checkListItem", props: { checked: true }, content: "帐篷、地钉和防潮垫" },
      { type: "checkListItem", props: { checked: false }, content: "充电宝充满电" },
    ],
  },
  {
    id: "page-reading",
    title: "七月阅读清单",
    icon: "📚",
    revision: 2,
    favorite: false,
    trashed: false,
    content: [
      { type: "paragraph", content: "把想读的书先放在这里，读完再整理笔记。" },
      { type: "numberedListItem", content: "置身事内" },
      { type: "numberedListItem", content: "可能性的艺术" },
    ],
  },
  {
    id: "page-ideas",
    title: "零散想法",
    icon: "💡",
    revision: 1,
    favorite: false,
    trashed: false,
    content: [{ type: "paragraph", content: "先写下来，稍后再决定放到哪里。" }],
  },
];

function fallbackSnapshot(): HarnessSnapshot {
  return {
    version: 1,
    pages: structuredClone(initialPages),
    tabs: [{ pageID: "page-plan", preview: false }],
    activeID: "page-plan",
    theme: "light",
  };
}

function isHarnessPage(value: unknown): value is HarnessPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<HarnessPage>;
  return typeof page.id === "string"
    && typeof page.title === "string"
    && typeof page.icon === "string"
    && Array.isArray(page.content)
    && typeof page.revision === "number"
    && typeof page.favorite === "boolean"
    && typeof page.trashed === "boolean";
}

function loadHarnessSnapshot(): HarnessSnapshot {
  const fallback = fallbackSnapshot();
  try {
    const raw = window.localStorage.getItem(HARNESS_STORAGE_KEY);
    if (!raw) return fallback;
    const candidate = JSON.parse(raw) as Partial<HarnessSnapshot>;
    if (candidate.version !== 1 || !Array.isArray(candidate.pages) || !Array.isArray(candidate.tabs)) return fallback;
    const pages = candidate.pages.filter(isHarnessPage);
    if (pages.length === 0) return fallback;
    const availableIDs = new Set(pages.filter((page) => !page.trashed).map((page) => page.id));
    const tabs = candidate.tabs.filter((tab): tab is HarnessTab => (
      Boolean(tab)
      && typeof tab.pageID === "string"
      && typeof tab.preview === "boolean"
      && availableIDs.has(tab.pageID)
    ));
    const activeID = typeof candidate.activeID === "string" && availableIDs.has(candidate.activeID)
      ? candidate.activeID
      : tabs[0]?.pageID ?? null;
    return {
      version: 1,
      pages,
      tabs,
      activeID,
      theme: candidate.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return fallback;
  }
}

function searchableText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(searchableText).join(" ");
  return "";
}

function Harness() {
  const initialSnapshotRef = useRef<HarnessSnapshot | null>(null);
  if (!initialSnapshotRef.current) initialSnapshotRef.current = loadHarnessSnapshot();
  const initialSnapshot = initialSnapshotRef.current;
  const [pages, setPages] = useState(initialSnapshot.pages);
  const [tabs, setTabs] = useState<HarnessTab[]>(initialSnapshot.tabs);
  const [activeID, setActiveID] = useState<string | null>(initialSnapshot.activeID);
  const [theme, setTheme] = useState<"light" | "dark">(initialSnapshot.theme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia("(max-width: 560px)").matches);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const generationRef = useRef(0);
  const activeIDRef = useRef(activeID);
  const pagesRef = useRef(pages);
  const tabsRef = useRef(tabs);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  activeIDRef.current = activeID;
  pagesRef.current = pages;
  tabsRef.current = tabs;

  const sendPage = (pageID: string) => {
    const page = pagesRef.current.find((item) => item.id === pageID);
    if (!page || !window.gooseEditor) return;
    generationRef.current += 1;
    const payload: EditorPagePayload = {
      version: 1,
      generation: generationRef.current,
      pageID: page.id,
      revision: page.revision,
      title: page.title,
      icon: page.icon,
      content: page.content,
      appearance: theme,
      editorFont: "serif",
      fullWidth: false,
      reduceMotion: false,
      increaseContrast: false,
    };
    window.gooseEditor.receivePage(payload);
  };

  const handleHostMessage = (message: BridgeMessage) => {
    if (message.type === "ready") {
      window.requestAnimationFrame(() => {
        if (activeIDRef.current) sendPage(activeIDRef.current);
      });
      return;
    }
    if (message.type === "reloadRequest") {
      sendPage(message.pageID);
      return;
    }
    if (message.type === "dirty") {
      if (message.pageID === activeIDRef.current) setSaveState("saving");
      return;
    }
    const draft = message as HostMessage;
    setSaveState("saving");
    window.setTimeout(() => {
      const currentPage = pagesRef.current.find((page) => page.id === draft.pageID);
      if (!currentPage) return;
      const changed = currentPage.title !== draft.title
        || currentPage.icon !== draft.icon
        || JSON.stringify(currentPage.content) !== JSON.stringify(draft.content);
      const nextRevision = changed
        ? Math.max(currentPage.revision + 1, draft.baseRevision + 1)
        : currentPage.revision;
      const nextPages = pagesRef.current.map((page) => page.id === draft.pageID ? {
        ...page,
        title: draft.title,
        icon: draft.icon,
        content: draft.content,
        revision: nextRevision,
      } : page);
      pagesRef.current = nextPages;
      setPages(nextPages);
      if (changed) {
        setTabs((current) => current.map((tab) => tab.pageID === draft.pageID ? { ...tab, preview: false } : tab));
      }
      const acknowledgement: SaveAcknowledgement = {
        version: 1,
        requestID: draft.requestID,
        pageID: draft.pageID,
        revision: nextRevision,
        status: "saved",
      };
      window.gooseEditor.receiveAcknowledgement(acknowledgement);
      setSaveState("saved");
    }, 90);
  };

  useLayoutEffect(() => installBrowserBridge(handleHostMessage));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.gooseEditor?.updatePreferences({
      appearance: theme,
      editorFont: "serif",
      fullWidth: false,
      reduceMotion: false,
      increaseContrast: false,
    });
  }, [theme]);

  useEffect(() => {
    const snapshot: HarnessSnapshot = { version: 1, pages, tabs, activeID, theme };
    try {
      window.localStorage.setItem(HARNESS_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // The browser harness is a development-only fallback. Native persistence remains authoritative.
    }
  }, [activeID, pages, tabs, theme]);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 560px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarCollapsed(true);
    };
    compactViewport.addEventListener("change", handleViewportChange);
    return () => compactViewport.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSearchOpen(false);
      window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  const openPage = (id: string, permanent = false) => {
    setTrashOpen(false);
    activeIDRef.current = id;
    setActiveID(id);
    setTabs((current) => {
      const existing = current.find((tab) => tab.pageID === id);
      if (existing) return current.map((tab) => tab.pageID === id && permanent ? { ...tab, preview: false } : tab);
      if (permanent) return [...current, { pageID: id, preview: false }];
      const previewIndex = current.findIndex((tab) => tab.preview);
      if (previewIndex >= 0) return current.map((tab, index) => index === previewIndex ? { pageID: id, preview: true } : tab);
      return [...current, { pageID: id, preview: true }];
    });
    window.requestAnimationFrame(() => sendPage(id));
  };

  const closeTab = (id: string) => {
    const index = tabsRef.current.findIndex((tab) => tab.pageID === id);
    const next = tabsRef.current.filter((tab) => tab.pageID !== id);
    tabsRef.current = next;
    setTabs(next);
    if (id === activeIDRef.current) {
      const replacement = next[Math.min(index, next.length - 1)];
      if (replacement) {
        activeIDRef.current = replacement.pageID;
        setActiveID(replacement.pageID);
        window.requestAnimationFrame(() => sendPage(replacement.pageID));
      } else {
        activeIDRef.current = null;
        setActiveID(null);
        window.gooseEditor?.clear();
      }
    }
  };

  const createPage = () => {
    const id = `page-${crypto.randomUUID()}`;
    const page: HarnessPage = {
      id,
      title: "",
      icon: "document",
      content: [{ type: "paragraph", content: [] }],
      revision: 0,
      favorite: false,
      trashed: false,
    };
    setPages((current) => [...current, page]);
    pagesRef.current = [...pagesRef.current, page];
    setTabs((current) => [...current, { pageID: id, preview: false }]);
    activeIDRef.current = id;
    setActiveID(id);
    window.requestAnimationFrame(() => sendPage(id));
  };

  const activePage = activeID ? pages.find((page) => page.id === activeID) : undefined;
  const visiblePages = pages.filter((page) => trashOpen ? page.trashed : !page.trashed);
  const results = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("zh-CN");
    if (!query) return pages.filter((page) => !page.trashed);
    return pages.filter((page) => {
      if (page.trashed) return false;
      const haystack = `${page.title} ${searchableText(page.content)}`.toLocaleLowerCase("zh-CN");
      return haystack.includes(query);
    });
  }, [pages, searchQuery]);

  const toggleFavorite = () => {
    if (!activePage) return;
    const nextPages = pagesRef.current.map((page) => page.id === activePage.id ? { ...page, favorite: !page.favorite } : page);
    pagesRef.current = nextPages;
    setPages(nextPages);
  };

  const trashPage = () => {
    if (!activePage) return;
    const nextPages = pagesRef.current.map((page) => page.id === activePage.id ? { ...page, trashed: true, favorite: false } : page);
    pagesRef.current = nextPages;
    setPages(nextPages);
    closeTab(activePage.id);
  };

  const restorePage = (id: string) => {
    const nextPages = pagesRef.current.map((page) => page.id === id ? { ...page, trashed: false } : page);
    pagesRef.current = nextPages;
    setPages(nextPages);
    setTrashOpen(false);
    window.setTimeout(() => openPage(id, true), 0);
  };

  return (
    <div className="harness" role="application" aria-label="鹅的笔记" data-theme={theme} data-testid="app-shell">
      <header className="harness-titlebar">
        <div className="traffic-lights" aria-hidden="true"><i /><i /><i /></div>
        <span className="harness-app-title">鹅的笔记</span>
        <button type="button" className="icon-button" aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </header>
      <div className="harness-body">
        <aside
          className={`harness-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`}
          aria-label="笔记导航"
          aria-hidden={sidebarCollapsed}
          inert={sidebarCollapsed}
        >
          <div className="notebook-title">
            <FolderOpen size={16} />
            <strong>我的笔记</strong>
            <ChevronDown size={13} />
            <button type="button" className="compact-sidebar-close" aria-label="关闭侧边栏" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16} /></button>
          </div>
          <button
            ref={searchTriggerRef}
            type="button"
            className="sidebar-action"
            onClick={() => { setSearchQuery(""); setSearchOpen(true); }}
          ><Search size={15} />搜索笔记<span>⌘K</span></button>
          <button type="button" className={`sidebar-action${!trashOpen ? " is-active" : ""}`} onClick={() => setTrashOpen(false)}><FileText size={15} />页面</button>
          <button type="button" className={`sidebar-action${trashOpen ? " is-active" : ""}`} onClick={() => setTrashOpen(true)}><Trash2 size={15} />回收站</button>
          <div className="sidebar-section-heading">
            <span>{trashOpen ? "已删除" : "页面"}</span>
            {!trashOpen && <button type="button" aria-label="新建页面" onClick={createPage}><FilePlus2 size={14} /></button>}
          </div>
          <nav className="page-list" aria-label={trashOpen ? "回收站页面" : "页面列表"}>
            {visiblePages.map((page) => (
              <div className="page-row-wrap" key={page.id}>
                <button
                  type="button"
                  className={`page-row${page.id === activeID && !trashOpen ? " is-active" : ""}`}
                  onClick={() => trashOpen ? undefined : openPage(page.id)}
                  onDoubleClick={() => trashOpen ? undefined : openPage(page.id, true)}
                >
                  <span>{page.icon === "document" ? <FileText size={14} /> : page.icon}</span>
                  <span>{page.title || "未命名"}</span>
                  {page.favorite && <Star size={11} fill="currentColor" aria-label="已收藏" />}
                </button>
                {trashOpen && <button type="button" className="restore-button" aria-label={`恢复${page.title}`} onClick={() => restorePage(page.id)}><ArchiveRestore size={14} /></button>}
              </div>
            ))}
            {visiblePages.length === 0 && <p className="sidebar-empty">{trashOpen ? "回收站是空的" : "还没有页面"}</p>}
          </nav>
          {!trashOpen && <button type="button" className="new-page-button" onClick={createPage}><FilePlus2 size={15} />新建页面</button>}
        </aside>
        <section className="harness-workspace">
          <div className="harness-toolbar">
            <button type="button" className="icon-button" aria-label={sidebarCollapsed ? "显示侧边栏" : "隐藏侧边栏"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <div className="harness-tabs" role="tablist" aria-label="打开的页面">
              {tabs.map((tab) => {
                const page = pages.find((item) => item.id === tab.pageID);
                if (!page) return null;
                return (
                  <div className={`harness-tab${tab.pageID === activeID ? " is-active" : ""}`} role="presentation" key={tab.pageID}>
                    <button
                      id={`page-tab-${tab.pageID}`}
                      type="button"
                      role="tab"
                      aria-selected={tab.pageID === activeID}
                      aria-controls="goose-editor-panel"
                      className={tab.preview ? "is-preview" : undefined}
                      onClick={() => openPage(tab.pageID, !tab.preview)}
                    >{page.title || "未命名"}</button>
                    <button type="button" aria-label={`关闭${page.title || "未命名"}`} onClick={() => closeTab(tab.pageID)}>×</button>
                  </div>
                );
              })}
            </div>
            <span className={`save-status is-${saveState}`} aria-live="polite">{saveState === "saving" ? "正在保存…" : saveState === "failed" ? "保存失败" : <><Check size={13} />已保存</>}</span>
            <button type="button" disabled={!activePage} className={`icon-button${activePage?.favorite ? " is-on" : ""}`} aria-label={activePage?.favorite ? "取消收藏" : "收藏页面"} onClick={toggleFavorite}><Star size={15} fill={activePage?.favorite ? "currentColor" : "none"} /></button>
            <button type="button" disabled={!activePage} className="icon-button" aria-label="移到回收站" onClick={trashPage}><Trash2 size={15} /></button>
          </div>
          <div
            id="goose-editor-panel"
            className="harness-editor"
            role="tabpanel"
            aria-labelledby={activeID ? `page-tab-${activeID}` : undefined}
          ><EditorSurface /></div>
        </section>
      </div>
      {searchOpen && (
        <div
          className="search-backdrop"
          role="presentation"
          onMouseDown={() => {
            setSearchOpen(false);
            window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
          }}
        >
          <section className="search-panel" role="dialog" aria-modal="true" aria-label="搜索笔记" onMouseDown={(event) => event.stopPropagation()}>
            <label><Search size={17} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索标题和正文" aria-label="搜索标题和正文" /></label>
            <div className="search-results" role="listbox">
              {results.map((page) => <button role="option" aria-selected="false" type="button" key={page.id} onClick={() => { setSearchOpen(false); openPage(page.id, true); }}><span>{page.icon === "document" ? "📄" : page.icon}</span><span>{page.title || "未命名"}</span></button>)}
              {results.length === 0 && <p>没有找到匹配的笔记</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>);
