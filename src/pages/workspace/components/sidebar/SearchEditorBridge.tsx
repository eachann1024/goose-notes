import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "@/components/ui/icons";
import type { EditorRef } from "@/components/editor/core/Editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useWorkspaceViewport } from "@/stores/useWorkspaceViewport";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { findCollapsedHeadingsHidingBlock, type SectionFoldBlock } from "@/components/editor/core/headingSectionFold";
import { clearSearchSessionHighlight, getSearchSessionHighlightState, selectSearchSessionHighlight, setSearchSessionHighlightQuery, subscribeSearchSessionHighlight } from "@/components/editor/find/searchSessionHighlightPlugin";
import { searchMemoryKey, useSearchSession } from "./useSearchSession";

export function SearchEditorBridge({ pageId, focused, editorRef, scrollRef }: {
  pageId: string; focused: boolean; editorRef: RefObject<EditorRef | null>; scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const session = useSearchSession();
  const page = usePages(s => s.pages[pageId]);
  const pages = usePages(s => s.pages);
  const notebooks = useNotebooks(s => s.notebooks);
  const [count, setCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState("");
  const [pathOpen, setPathOpen] = useState(false);
  const frame = useRef(0);
  const handled = useRef(0);
  const visible = session.open && focused;
  const key = searchMemoryKey(pageId, session.query, session.scope);
  const close = () => {
    session.closeSearch();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.sidebar-mode-rail-button[aria-label="搜索"]')?.focus({ preventScroll: true }));
  };
  const locate = () => {
    const editor = editorRef.current?.editor;
    if (!editor || editor._tiptapEditor.isDestroyed) return;
    const state = getSearchSessionHighlightState(editor);
    const match = state?.matches[state.current];
    if (!match) { if (page && session.query && getPageTitle(page).toLowerCase().includes(session.query.trim().toLowerCase()) && scrollRef.current) scrollRef.current.scrollTop = 0; return; }
    const dom = editor.prosemirrorView.domAtPos(match.from);
    const element = dom.node.nodeType === Node.TEXT_NODE ? dom.node.parentElement : dom.node as HTMLElement;
    const blockId = element?.closest("[data-id]")?.getAttribute("data-id");
    if (blockId) {
      const ids = findCollapsedHeadingsHidingBlock(editor.document as SectionFoldBlock[], blockId, editor.document[0]?.id);
      for (const id of ids) { const block = editor.getBlock(id); if (block?.type === "heading") editor.updateBlock(block, { props: { collapsed: false } }); }
      let ancestor = element?.parentElement;
      while (ancestor && ancestor !== editor.prosemirrorView.dom) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
    }
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!useSearchSession.getState().open || editor._tiptapEditor.isDestroyed) return;
      const scroller = scrollRef.current;
      const target = (editor.prosemirrorView.dom as HTMLElement).querySelector<HTMLElement>(".goose-search-session-match--current");
      if (!scroller || !target) return;
      const hit = target.getBoundingClientRect(), box = scroller.getBoundingClientRect();
      scroller.scrollTop += hit.top - box.top - scroller.clientHeight / 2 + hit.height / 2;
    });
  };
  const step = (delta: number) => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    const value = getSearchSessionHighlightState(editor);
    if (!value?.matches.length) return;
    const next = (value.current + delta + value.matches.length) % value.matches.length;
    selectSearchSessionHighlight(editor, next, false);
    session.rememberMatch(key, next);
    setMessage(delta > 0 && next === 0 ? "已回到第一处" : delta < 0 && next === value.matches.length - 1 ? "已回到最后一处" : "");
    locate();
  };
  useEffect(() => {
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const editor = editorRef.current?.editor;
      if (!editor || editor._tiptapEditor.isDestroyed) return;
      // Editor stamps this only after replacing the document for this page.
      if (editor.prosemirrorView.dom.dataset.searchPageId !== pageId) return;
      const previous = getSearchSessionHighlightState(editor);
      const query = visible ? session.query.trim() : "";
      if (previous?.query !== query) {
        setSearchSessionHighlightQuery(editor, query, false);
        const saved = useSearchSession.getState().memories[key] ?? 0;
        const total = getSearchSessionHighlightState(editor)?.matches.length ?? 0;
        if (total) selectSearchSessionHighlight(editor, Math.min(saved, total - 1), false);
      }
      const state = getSearchSessionHighlightState(editor);
      setCount(state?.matches.length ?? 0); setCurrent((state?.current ?? -1) + 1);
      const request = useSearchSession.getState();
      if (visible && request.targetPageId === pageId && request.requestNonce !== handled.current) {
        handled.current = request.requestNonce;
        if (request.restoreTop !== null && scrollRef.current) scrollRef.current.scrollTop = request.restoreTop;
        else locate();
        if (request.enterReader) {
          scrollRef.current?.focus({ preventScroll: true });
        }
        if (useWorkspaceViewport.getState().forceCollapseLeft && (request.enterReader || document.activeElement?.tagName !== "INPUT")) {
          useWorkspaceViewport.getState().setLeftExpandOverride(false);
        }
      }
    };
    const refresh = () => {
      const editor = editorRef.current?.editor;
      if (!editor || editor._tiptapEditor.isDestroyed) return;
      const state = getSearchSessionHighlightState(editor);
      setCount(state?.matches.length ?? 0); setCurrent((state?.current ?? -1) + 1);
    };
    const unsubscribe = subscribeSearchSessionHighlight((_state, view) => {
      if (editorRef.current?.editor?.prosemirrorView === view) refresh();
    });
    const start = requestAnimationFrame(apply);
    window.addEventListener("goose-note:search-editor-ready", apply);
    return () => { cancelled = true; cancelAnimationFrame(start); cancelAnimationFrame(frame.current); unsubscribe(); window.removeEventListener("goose-note:search-editor-ready", apply); };
  }, [visible, pageId, session.query, session.requestNonce, key, editorRef, scrollRef]);
  useEffect(() => () => {
    const editor = editorRef.current?.editor;
    if (editor && !editor._tiptapEditor.isDestroyed) clearSearchSessionHighlight(editor);
  }, [editorRef]);
  useEffect(() => {
    if (!visible) { setPathOpen(false); return; }
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (event.key === "F3" && !document.querySelector("[data-goose-find-in-page]")) { event.preventDefault(); step(event.shiftKey ? -1 : 1); }
      if (event.key === "Escape" && !pathOpen && !document.querySelector("[data-goose-find-in-page]")) { event.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, pathOpen, key]);
  if (!visible || !page) return null;
  const crumbs = [getPageTitle(page)];
  const seen = new Set([page.id]); let parentId = page.parentId;
  while (parentId && pages[parentId] && !seen.has(parentId)) { seen.add(parentId); crumbs.unshift(getPageTitle(pages[parentId])); parentId = pages[parentId].parentId; }
  crumbs.unshift(notebooks[page.workspaceId]?.name ?? "笔记本");
  const titleOnly = !count && session.query.trim() && getPageTitle(page).toLowerCase().includes(session.query.trim().toLowerCase());
  return <>
    <div className="search-editor-path"><Popover open={pathOpen} onOpenChange={setPathOpen}><PopoverTrigger asChild><button aria-label="查看笔记完整路径" title={crumbs.join(" / ")}>{crumbs.length > 2 ? `${crumbs[0]} / ${crumbs.at(-2)}` : crumbs.join(" / ")}</button></PopoverTrigger><PopoverContent align="end" className="max-w-[min(24rem,85vw)] break-words text-sm">{crumbs.join(" / ")}</PopoverContent></Popover></div>
    <div className="search-editor-matchbar" aria-label="搜索命中导航">
      <button aria-label="返回搜索结果" onClick={() => window.dispatchEvent(new CustomEvent("goose-note:open-search"))}><ArrowLeft size={16}/><span>搜索结果</span></button>
      <span role="status">{count ? `${current} / ${count} 处` : titleOnly ? "标题匹配" : "正文无匹配"}</span>
      <button aria-label="上一处匹配" disabled={!count} onClick={() => step(-1)}><ChevronUp size={16}/></button><button aria-label="下一处匹配" disabled={!count} onClick={() => step(1)}><ChevronDown size={16}/></button>
      <span className="search-match-message" aria-live="polite">{message}</span>
      <button disabled={!session.originPageId || !pages[session.originPageId]} onClick={() => session.originPageId && session.targetPage(session.originPageId, true, session.originScrollTop)}>返回起始笔记</button>
      <button aria-label="退出搜索" onClick={close}><X size={16}/></button>
    </div>
  </>;
}
