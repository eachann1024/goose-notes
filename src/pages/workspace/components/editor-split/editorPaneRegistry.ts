import { createContext, useContext, type RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";

type PaneEntry = {
  paneId: string;
  pageId: string;
  editorRef: RefObject<EditorRef | null>;
  scrollEl: HTMLDivElement | null;
  lastEditor: EditorRef["editor"];
};

export type FocusedPaneSnapshot = {
  paneId: string;
  pageId: string;
  editor: EditorRef["editor"];
  scrollEl: HTMLDivElement | null;
};

export type EditorPaneRegistry = {
  register: (
    paneId: string,
    pageId: string,
    editorRef: RefObject<EditorRef | null>,
    scrollEl: HTMLDivElement | null,
  ) => void;
  unregister: (paneId: string) => void;
  setFocused: (paneId: string) => void;
  focusedEditorRef: RefObject<EditorRef | null>;
  focusedScrollRef: RefObject<HTMLDivElement | null>;
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  getFocusedEntry: () => FocusedPaneSnapshot | null;
  getScrollElements: () => HTMLDivElement[];
};

export function createEditorPaneRegistry(): EditorPaneRegistry {
  const panes = new Map<string, PaneEntry>();
  const listeners = new Set<() => void>();
  let focusedPaneId: string | null = null;
  let version = 0;

  const notify = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };

  const focusedEntry = (): PaneEntry | undefined => {
    if (focusedPaneId) {
      const focused = panes.get(focusedPaneId);
      if (focused) return focused;
    }
    return panes.values().next().value;
  };

  const focusedEditorRef: RefObject<EditorRef | null> = {
    get current() {
      return focusedEntry()?.editorRef.current ?? null;
    },
    set current(_value) {
      // 聚焦代理只读；各叶自己的 Editor ref 才写入。
    },
  };

  const focusedScrollRef: RefObject<HTMLDivElement | null> = {
    get current() {
      return focusedEntry()?.scrollEl ?? null;
    },
    set current(_value) {
      // 聚焦代理只读；各叶用 callback ref 登记滚动容器。
    },
  };

  return {
    register(paneId, pageId, editorRef, scrollEl) {
      if (editorRef.current === null && scrollEl === null) return;
      const lastEditor = editorRef.current?.editor ?? null;
      const previous = panes.get(paneId);
      if (
        previous?.pageId === pageId &&
        previous.editorRef === editorRef &&
        previous.scrollEl === scrollEl &&
        previous.lastEditor === lastEditor
      ) {
        return;
      }
      panes.set(paneId, { paneId, pageId, editorRef, scrollEl, lastEditor });
      notify();
    },
    unregister(paneId) {
      if (!panes.delete(paneId)) return;
      if (focusedPaneId === paneId) focusedPaneId = null;
      notify();
    },
    setFocused(paneId) {
      if (focusedPaneId === paneId) return;
      focusedPaneId = paneId;
      notify();
    },
    focusedEditorRef,
    focusedScrollRef,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion() {
      return version;
    },
    getFocusedEntry() {
      const entry = focusedEntry();
      if (!entry) return null;
      return {
        paneId: entry.paneId,
        pageId: entry.pageId,
        editor: entry.editorRef.current?.editor ?? null,
        scrollEl: entry.scrollEl,
      };
    },
    getScrollElements() {
      const elements: HTMLDivElement[] = [];
      for (const entry of panes.values()) {
        if (entry.scrollEl) elements.push(entry.scrollEl);
      }
      return elements;
    },
  };
}

const EditorPaneRegistryContext = createContext<EditorPaneRegistry | null>(
  null,
);

export const EditorPaneRegistryProvider = EditorPaneRegistryContext.Provider;

export function useEditorPaneRegistry(): EditorPaneRegistry {
  const registry = useContext(EditorPaneRegistryContext);
  if (!registry) {
    throw new Error("EditorPaneRegistryProvider 未挂载");
  }
  return registry;
}

export function useOptionalEditorPaneRegistry(): EditorPaneRegistry | null {
  return useContext(EditorPaneRegistryContext);
}
