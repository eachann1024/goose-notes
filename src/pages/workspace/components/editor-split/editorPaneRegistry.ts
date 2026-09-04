import { createContext, useContext, type RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";

type PaneEntry = {
  editorRef: RefObject<EditorRef | null>;
  scrollEl: HTMLDivElement | null;
};

export type EditorPaneRegistry = {
  register: (
    paneId: string,
    editorRef: RefObject<EditorRef | null>,
    scrollEl: HTMLDivElement | null,
  ) => void;
  unregister: (paneId: string) => void;
  setFocused: (paneId: string) => void;
  focusedEditorRef: RefObject<EditorRef | null>;
  focusedScrollRef: RefObject<HTMLDivElement | null>;
  getScrollElements: () => HTMLDivElement[];
};

export function createEditorPaneRegistry(): EditorPaneRegistry {
  const panes = new Map<string, PaneEntry>();
  let focusedPaneId: string | null = null;

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
    register(paneId, editorRef, scrollEl) {
      panes.set(paneId, { editorRef, scrollEl });
    },
    unregister(paneId) {
      panes.delete(paneId);
      if (focusedPaneId === paneId) focusedPaneId = null;
    },
    setFocused(paneId) {
      focusedPaneId = paneId;
    },
    focusedEditorRef,
    focusedScrollRef,
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
