import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { BlockNoteEditor } from "@blocknote/core";
import { collectMatches, type FindMatch } from "./findInPagePlugin";

export type SearchSessionHighlightState = {
  query: string;
  matches: FindMatch[];
  current: number;
};

type Meta =
  | { type: "set"; query: string }
  | { type: "select"; index: number }
  | { type: "step"; delta: number }
  | { type: "clear" };

const emptyState: SearchSessionHighlightState = { query: "", matches: [], current: -1 };
export const searchSessionHighlightKey = new PluginKey<SearchSessionHighlightState>("goose-search-session-highlight");
const subscribers = new Set<(state: SearchSessionHighlightState, view: EditorView) => void>();

export const searchSessionHighlightPlugin = new Plugin<SearchSessionHighlightState>({
  key: searchSessionHighlightKey,
  state: {
    init: () => emptyState,
    apply(tr, state, _oldState, nextState) {
      const meta = tr.getMeta(searchSessionHighlightKey) as Meta | undefined;
      if (meta?.type === "clear") return emptyState;
      if (meta?.type === "set") {
        const matches = collectMatches(nextState.doc, meta.query, false);
        return { query: meta.query, matches, current: matches.length ? 0 : -1 };
      }
      if (meta?.type === "select") {
        return meta.index >= 0 && meta.index < state.matches.length ? { ...state, current: meta.index } : state;
      }
      if (meta?.type === "step") {
        if (!state.matches.length) return state;
        return { ...state, current: ((state.current + meta.delta) % state.matches.length + state.matches.length) % state.matches.length };
      }
      if (tr.docChanged && state.query) {
        const matches = collectMatches(nextState.doc, state.query, false);
        return { ...state, matches, current: matches.length ? Math.min(Math.max(state.current, 0), matches.length - 1) : -1 };
      }
      return state;
    },
  },
  props: {
    decorations(state) {
      const value = searchSessionHighlightKey.getState(state);
      if (!value?.matches.length) return null;
      return DecorationSet.create(state.doc, value.matches.map((match, idx) =>
        Decoration.inline(match.from, match.to, {
          class: idx === value.current ? "goose-search-session-match goose-search-session-match--current" : "goose-search-session-match",
        }),
      ));
    },
  },
  view(_view: EditorView) {
    let last: SearchSessionHighlightState | null = null;
    return {
      update(view) {
        const state = searchSessionHighlightKey.getState(view.state);
        if (state && state !== last) {
          last = state;
          subscribers.forEach((listener) => listener(state, view));
        }
      },
    };
  },
});

export const gooseSearchSessionHighlightExtension = createExtension({
  key: "goose-search-session-highlight",
  prosemirrorPlugins: [searchSessionHighlightPlugin],
});

function getView(editor: BlockNoteEditor<any, any, any>): EditorView | null {
  if (editor._tiptapEditor.isDestroyed) return null;
  try { return (editor.prosemirrorView as EditorView | undefined) ?? null; } catch { return null; }
}

export function getSearchSessionHighlightState(editor: BlockNoteEditor<any, any, any>): SearchSessionHighlightState | null {
  const view = getView(editor);
  return view ? searchSessionHighlightKey.getState(view.state) ?? null : null;
}

export function subscribeSearchSessionHighlight(listener: (state: SearchSessionHighlightState, view: EditorView) => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function dispatch(editor: BlockNoteEditor<any, any, any>, meta: Meta): EditorView | null {
  const view = getView(editor);
  if (view) view.dispatch(view.state.tr.setMeta(searchSessionHighlightKey, meta));
  return view;
}

export function setSearchSessionHighlightQuery(editor: BlockNoteEditor<any, any, any>, query: string, scroll = false): void {
  const view = dispatch(editor, query.trim() ? { type: "set", query: query.trim() } : { type: "clear" });
  if (scroll) scrollToCurrent(view);
}

export function selectSearchSessionHighlight(editor: BlockNoteEditor<any, any, any>, index: number, scroll = true): void {
  const view = dispatch(editor, { type: "select", index });
  if (scroll) scrollToCurrent(view);
}

export function stepSearchSessionHighlight(editor: BlockNoteEditor<any, any, any>, delta: number, scroll = true): void {
  const view = dispatch(editor, { type: "step", delta });
  if (scroll) scrollToCurrent(view);
}

export function clearSearchSessionHighlight(editor: BlockNoteEditor<any, any, any>): void {
  dispatch(editor, { type: "clear" });
}

function scrollToCurrent(view: EditorView | null): void {
  if (!view) return;
  const value = searchSessionHighlightKey.getState(view.state);
  if (!value || value.current < 0) return;
  try {
    const dom = view.domAtPos(value.matches[value.current].from);
    const element = dom.node.nodeType === Node.TEXT_NODE ? dom.node.parentElement : dom.node as HTMLElement;
    element?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  } catch { /* editor view may be in teardown */ }
}
