import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { useCommandSearch, type SearchResultPage } from "../command/useCommandSearch";
import { matchingSplitPaletteActions } from "../command/splitPaletteActions";
import { useSearchSession } from "./useSearchSession";
import "./sidebar-search.css";

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const parts = []; let cursor = 0, index = text.toLowerCase().indexOf(needle);
  while (index >= 0) {
    parts.push(<Fragment key={index}>{text.slice(cursor, index)}<mark>{text.slice(index, index + needle.length)}</mark></Fragment>);
    cursor = index + needle.length; index = text.toLowerCase().indexOf(needle, cursor);
  }
  return <>{parts}{text.slice(cursor)}</>;
}
export function SidebarSearch() {
  const session = useSearchSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState(session.query);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const notebooks = useNotebooks(s => s.notebooks);
  const pages = usePages(s => s.pages);
  const showRecent = useSettings(s => s.showRecentInSearch);
  const setShowRecent = useSettings(s => s.setShowRecentInSearch);
  const scopedId = session.scope.kind === "all" ? null : session.scope.notebookId;
  const { searchResults, deferredQuery, setSearchQuery, loadMoreResults, removeRecent } = useCommandSearch({ pages, activeNotebookId: scopedId, searchAllNotebooks: session.scope.kind === "all" });
  useEffect(() => { setSearchQuery(session.query); if (!composing.current) setDraft(session.query); }, [session.query, setSearchQuery]);
  useEffect(() => {
    if (!session.open) return;
    inputRef.current?.focus({ preventScroll: true });
    if (listRef.current) listRef.current.scrollTop = useSearchSession.getState().listScrollTop;
  }, [session.open, session.focusNonce]);
  useEffect(() => {
    if (!session.open) return;
    let cancelled = false;
    const targets = Object.values(useNotebooks.getState().notebooks).filter(n =>
      (session.scope.kind === "all" || n.id === scopedId) && n.source === "local-folder" && n.localPath);
    setLoading(true); setLoadError(false);
    Promise.all(targets.map(n => usePages.getState().loadLocalFolderPages(n.id, n.localPath!)))
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.open, session.scope.kind, scopedId, retry]);
  const hasQuery = Boolean(session.query.trim());
  const results = hasQuery ? searchResults.allDisplay : showRecent ? searchResults.recent : [];
  const pending = session.query !== deferredQuery;
  const selected = results.find(p => p.id === session.selectedPageId) ?? results[0];
  const duplicates = new Set(results.filter(p => results.some(other => other.id !== p.id && getPageTitle(other) === getPageTitle(p))).map(getPageTitle));
  const close = () => {
    session.closeSearch();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.sidebar-mode-rail-button[aria-label="搜索"]')?.focus({ preventScroll: true }));
  };
  const openResult = (page: SearchResultPage, enter = false) => { if (!pending) session.targetPage(page.id, enter); };
  const reveal = (id: string) => {
    const list = listRef.current, row = document.getElementById(`search-result-${id}`);
    if (!list || !row) return;
    const a = list.getBoundingClientRect(), b = row.getBoundingClientRect();
    if (b.top < a.top) list.scrollTop += b.top - a.top;
    else if (b.bottom > a.bottom) list.scrollTop += b.bottom - a.bottom;
  };
  const keydown = (event: React.KeyboardEvent) => {
    if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      const index = results.findIndex(p => p.id === selected?.id);
      const next = Math.max(0, Math.min(results.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      if (next >= results.length - 2 && searchResults.hasMore) loadMoreResults();
      openResult(results[next]); requestAnimationFrame(() => reveal(results[next].id));
    }
    if (event.key === "Enter" && selected && !pending) { event.preventDefault(); openResult(selected, true); }
  };
  const scopeValue = session.scope.kind === "notebook" ? `notebook:${scopedId}` : session.scope.kind;
  const currentName = notebooks[session.startingNotebookId ?? ""]?.name ?? "当前笔记本";
  const scopeLabel = session.scope.kind === "all" ? "所有笔记本" : session.scope.kind === "current" ? `当前笔记本 · ${notebooks[scopedId ?? ""]?.name ?? currentName}` : notebooks[scopedId ?? ""]?.name ?? "笔记本已移除";
  return <section className="sidebar-search" aria-label="全局搜索" hidden={!session.open}>
    <div className="sidebar-search-heading"><strong>搜索笔记</strong><button aria-label="关闭搜索" onClick={close}><X size={16}/></button></div>
    <div className="sidebar-search-input-wrap"><Search size={16} aria-hidden="true"/><input ref={inputRef} role="combobox" aria-label="搜索笔记" aria-controls="sidebar-search-results" aria-expanded={session.open} aria-autocomplete="list" aria-activedescendant={selected ? `search-result-${selected.id}` : undefined} value={draft} placeholder="搜索笔记内容…" autoComplete="off" spellCheck={false}
      onChange={e => { setDraft(e.target.value); if (!composing.current) session.setQuery(e.target.value); }}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={e => { composing.current = false; session.setQuery(e.currentTarget.value); }} onKeyDown={keydown}/>
      <button aria-label="清空搜索" disabled={!draft} onClick={() => { session.setQuery(""); inputRef.current?.focus(); }}><X size={16}/></button></div>
    <div className="sidebar-search-filters"><DropdownMenu><DropdownMenuTrigger asChild><button className="sidebar-search-scope" aria-label="搜索范围"><span>{scopeLabel}</span><ChevronDown size={14}/></button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64"><DropdownMenuRadioGroup value={scopeValue} onValueChange={value => session.setScope(value === "all" ? { kind: "all" } : value === "current" ? { kind: "current", notebookId: session.startingNotebookId } : { kind: "notebook", notebookId: value.slice(9) })}>
        <DropdownMenuRadioItem value="current">当前笔记本 · {currentName}</DropdownMenuRadioItem><DropdownMenuRadioItem value="all">所有笔记本</DropdownMenuRadioItem>
        {Object.values(notebooks).map(n => <DropdownMenuRadioItem key={n.id} value={`notebook:${n.id}`}>{n.name}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu><span role="status">{loading || pending ? "搜索中…" : hasQuery ? `${searchResults.all.length} 篇` : ""}</span></div>
    {!hasQuery && showRecent && <button className="sidebar-search-hide-recent" onClick={() => setShowRecent(false)}>隐藏最近访问</button>}
    {loadError && <div className="sidebar-search-empty" role="alert">部分笔记本读取失败<button onClick={() => setRetry(n => n + 1)}>重试读取</button></div>}
    <div ref={listRef} className="sidebar-search-results" onScroll={e => { const el = e.currentTarget; useSearchSession.setState({ listScrollTop: el.scrollTop }); if (hasQuery && searchResults.hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 100) loadMoreResults(); }}>
      <div id="sidebar-search-results" role="listbox" aria-label="搜索结果" tabIndex={0} onKeyDown={keydown} aria-activedescendant={selected ? `search-result-${selected.id}` : undefined}>
      {results.map(page => <div className="sidebar-search-result-wrap" key={page.id}>
        <button id={`search-result-${page.id}`} type="button" role="option" aria-selected={page.id === selected?.id} className="sidebar-search-result rounded-lg" onClick={() => openResult(page)}>
          <span className="sidebar-search-result-title"><Highlight text={getPageTitle(page)} query={session.query}/></span>
          <span className="sidebar-search-result-count">{hasQuery && (page.literalBodyMatchCount ? `${page.literalBodyMatchCount} 处` : page.matchKind === "title" ? "标题" : page.matchKind === "pinyin" ? "拼音" : "相关")}</span>
          {duplicates.has(getPageTitle(page)) && <span className="sidebar-search-book">{notebooks[page.workspaceId]?.name}</span>}
          {hasQuery && <span className="sidebar-search-snippet"><Highlight text={page.matchKind === "title" ? "标题匹配 · 正文无命中" : page.matchKind === "pinyin" ? "标题拼音匹配" : page.matchKind === "token" ? "相关词匹配 · 无连续词组" : page.contentSnippet ?? ""} query={session.query}/></span>}
        </button>
        {!hasQuery && <button className="sidebar-search-remove" aria-label={`从最近访问中移除 ${getPageTitle(page)}`} onClick={() => removeRecent(page.id)}><X size={14}/></button>}
      </div>)}
      </div>
      {!loading && !pending && !results.length && <div className="sidebar-search-empty"><strong>{hasQuery ? `没有找到“${session.query.trim()}”` : "从一句话开始找"}</strong>{hasQuery ? <><button onClick={() => { session.setQuery(""); inputRef.current?.focus(); }}>清空搜索</button>{session.scope.kind !== "all" && <button onClick={() => session.setScope({ kind: "all" })}>扩大到所有笔记本</button>}</> : <p>输入标题或记得的内容。</p>}</div>}
      {hasQuery && searchResults.hasMore && <button className="sidebar-search-more" onClick={loadMoreResults}>加载更多结果</button>}
      {matchingSplitPaletteActions(session.query).map(action => <button key={action.id} className="sidebar-search-command rounded-lg" onClick={() => { action.run(); session.closeSearch(); }}>{action.label}</button>)}
    </div>
    <div className="sidebar-search-footer">↑ ↓ 预览 · Enter 阅读 · Esc 退出</div>
  </section>;
}
