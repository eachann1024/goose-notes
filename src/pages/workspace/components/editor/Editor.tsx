import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BlockNoteViewRaw as BlockNoteView,
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/react/style.css";
import debounce from "lodash.debounce";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { cn } from "@/lib/utils";
import {
  clonePageContent,
  getContentSignature,
  normalizePageContent,
  type BlockNoteContent,
} from "@/lib/blocknote-content";
import {
  getBlockNoteSlashMenuItems,
  filterSlashMenuItems,
} from "@/pages/workspace/components/command/blocknoteSlashItems";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import { EditorFormattingToolbar } from "./EditorFormattingToolbar";

interface EditorProps {
  editable?: boolean;
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages();
  const { notebooks } = useNotebooks();
  const { globalEditorFullWidth, customFonts, theme } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const isEditorFullWidth = Boolean(
    notebook?.editorFullWidth ?? globalEditorFullWidth,
  );

  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const initialContent = useMemo(
    () => normalizePageContent(page?.content),
    [page?.id],
  );

  const editor = useCreateBlockNote(
    {
      initialContent,
      dictionary: {
        ...zh,
        placeholders: {
          ...zh.placeholders,
          default: "输入 / 或 、来展开菜单...",
        },
      },
      domAttributes: {
        editor: {
          class: "goose-blocknote-editor",
        },
      },
    },
    [page?.id],
  );

  const getSlashItems = useCallback(
    async (query: string) => {
      const items = getBlockNoteSlashMenuItems(editor);
      return filterSlashMenuItems(items, query);
    },
    [editor],
  );

  const debouncedUpdate = useMemo(() => {
    return debounce(
      (id: string, content: BlockNoteContent) => {
        syncedContentSignatureRef.current = getContentSignature(content);
        updatePage(id, { content });
      },
      800,
      { maxWait: 3000 },
    );
  }, [updatePage]);

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = clonePageContent(editor.document as BlockNoteContent);
      debouncedUpdate.cancel();
      syncedContentSignatureRef.current = getContentSignature(nextContent);
      updatePage(safePageId, { content: nextContent });
    },
    [debouncedUpdate, editor, updatePage],
  );

  useEffect(() => {
    if (!page) return;

    const normalized = normalizePageContent(page.content);
    const normalizedSignature = getContentSignature(normalized);
    pageIdForUpdateRef.current = page.id;
    syncedContentSignatureRef.current = normalizedSignature;

    if (getContentSignature(page.content) !== normalizedSignature) {
      updatePage(page.id, { content: normalized });
    }
  }, [page?.id, page?.content, page, updatePage]);

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  useEffect(() => {
    const handleFlush = (event: Event) => {
      const customEvent = event as CustomEvent<{ immediate?: boolean }>;
      if (customEvent.detail?.immediate) {
        commitEditorContent();
        return;
      }
      commitEditorContent();
    };

    const handleFocusStart = () => {
      editor.focus();
    };

    window.addEventListener("goose-note:flush-editor", handleFlush);
    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);

    return () => {
      window.removeEventListener("goose-note:flush-editor", handleFlush);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
    };
  }, [commitEditorContent, editor]);

  useEffect(() => {
    (window as any).__gooseNoteEditor = editor;
    return () => {
      if ((window as any).__gooseNoteEditor === editor) {
        (window as any).__gooseNoteEditor = null;
      }
    };
  }, [editor]);

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

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

  if (!page) return null;

  return (
    <div
      ref={editorContainerRef}
      data-font-family={page.fontFamily ?? "default"}
      className={cn(
        "workspace-editor-surface mx-auto min-h-[480px] w-full px-6 pb-24 pt-2",
        isEditorFullWidth ? "max-w-none" : "max-w-4xl",
      )}
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={effectiveTheme}
        slashMenu={false}
        onChange={() => {
          const safePageId = pageIdForUpdateRef.current;
          if (!safePageId) return;
          const nextContent = clonePageContent(editor.document as BlockNoteContent);
          syncedContentSignatureRef.current = getContentSignature(nextContent);
          debouncedUpdate(safePageId, nextContent);
        }}
      >
        <FormattingToolbarController
          formattingToolbar={EditorFormattingToolbar}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashItems}
          shouldOpen={(event) => {
            return !event.selection.$from.parent.type.isInGroup("tableContent");
          }}
          suggestionMenuComponent={CustomSlashMenu}
          onItemClick={(item) => {
            if (item && "onItemClick" in item) {
              (item as any).onItemClick();
            }
          }}
        />
        <SuggestionMenuController
          triggerCharacter="、"
          getItems={getSlashItems}
          shouldOpen={(event) => {
            return !event.selection.$from.parent.type.isInGroup("tableContent");
          }}
          suggestionMenuComponent={CustomSlashMenu}
          onItemClick={(item) => {
            if (item && "onItemClick" in item) {
              (item as any).onItemClick();
            }
          }}
        />
      </BlockNoteView>
    </div>
  );
}
