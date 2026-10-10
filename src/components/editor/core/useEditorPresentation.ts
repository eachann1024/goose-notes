import { useCallback, useEffect, useState } from "react";
import { isQuickNoteEditorPage } from "@/pages/workspace/components/editor-host/editorContentMode";
import { setPageMentionOpenHandler } from "@/components/editor/inline/pageMentionBridge";
import {
  rememberEditorSelectedBlocks,
  readLiveEditorSelectedBlocks,
  clearEditorSelectedBlocksCache,
} from "@/components/editor/utils/selection";
import {
  getBlockNoteSlashMenuItems,
  filterSlashMenuItems,
  warmupSlashMenuIcons,
} from "./blocknoteSlashItems";
import type { EditorRuntime } from "./useEditorSession";

export function useEditorPresentation(
  runtime: EditorRuntime,
  isActiveEditor: boolean,
  hiddenSlashItemTitles?: string[],
) {
  const { editor, aiSettingsRef, settingsRef, page, onOpenPageRef, theme } =
    runtime;
  const getSlashItems = useCallback(
    async (query: string) => {
      let items = getBlockNoteSlashMenuItems(
        editor,
        aiSettingsRef.current.enabled,
        settingsRef.current.features,
        { compact: isQuickNoteEditorPage(page) },
      );
      if (hiddenSlashItemTitles && hiddenSlashItemTitles.length > 0) {
        const hidden = new Set(hiddenSlashItemTitles);
        const isDivider = (it: (typeof items)[number]) =>
          (it as { type?: string }).type === "divider";
        const kept = items.filter((item) => !hidden.has(item.title));
        // 砍项后清理冗余分隔线：折叠连续/首部 divider，再去尾部 divider。
        const collapsed: typeof items = [];
        for (const it of kept) {
          if (
            isDivider(it) &&
            (collapsed.length === 0 ||
              isDivider(collapsed[collapsed.length - 1]))
          ) {
            continue;
          }
          collapsed.push(it);
        }
        while (
          collapsed.length > 0 &&
          isDivider(collapsed[collapsed.length - 1])
        ) {
          collapsed.pop();
        }
        items = collapsed;
      }
      return filterSlashMenuItems(items, query);
    },
    [editor, hiddenSlashItemTitles, page],
  );
  useEffect(() => {
    const warm = () => {
      warmupSlashMenuIcons();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!isActiveEditor) return;
    (window as any).__gooseNoteEditor = editor;
    setPageMentionOpenHandler((pageId, wikiTarget, options) =>
      onOpenPageRef.current(pageId, wikiTarget, options),
    );
    const rememberLiveSelection = () => {
      rememberEditorSelectedBlocks(editor);
    };
    const syncSelectionCacheAfterPointer = (event: Event) => {
      const target = event.target;
      const insideEditor =
        target instanceof Node && Boolean(editor.domElement?.contains(target));
      if (!insideEditor) return;
      const live = readLiveEditorSelectedBlocks(editor);
      if (live.length > 0) {
        rememberEditorSelectedBlocks(editor);
        return;
      }
      clearEditorSelectedBlocksCache(editor);
    };
    document.addEventListener("selectionchange", rememberLiveSelection);
    document.addEventListener(
      "pointerup",
      syncSelectionCacheAfterPointer,
      true,
    );
    return () => {
      document.removeEventListener("selectionchange", rememberLiveSelection);
      document.removeEventListener(
        "pointerup",
        syncSelectionCacheAfterPointer,
        true,
      );
      if ((window as any).__gooseNoteEditor === editor) {
        (window as any).__gooseNoteEditor = null;
      }
      setPageMentionOpenHandler(null);
      clearEditorSelectedBlocksCache(editor);
    };
  }, [editor, isActiveEditor]);

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(
    "light",
  );

  useEffect(() => {
    const resolve = () => {
      if (theme === "dark") {
        setEffectiveTheme("dark");
        return;
      }
      if (theme === "system") {
        setEffectiveTheme(
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
        );
        return;
      }
      setEffectiveTheme("light");
    };
    resolve();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => resolve();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return { getSlashItems, effectiveTheme };
}
