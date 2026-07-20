import { useCallback, useEffect, useRef, useState } from "react";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { AlertCircle, FileText, RotateCcw } from "lucide-react";
import { postToHost } from "../lib/bridge";
import type {
  EditorDraft,
  EditorFont,
  EditorPagePayload,
  EditorPreferences,
  SaveAcknowledgement,
} from "../lib/types";

const EMPTY_CONTENT: PartialBlock[] = [{ type: "paragraph", content: [] }];
const ICONS = ["document", "🪿", "📝", "📚", "💡", "🌿", "📌"];

type SaveVisualState = "idle" | "saving" | "saved" | "failed" | "conflict";

function createRequestID() {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

async function fileToDataURL(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("单个附件不能超过 8 MB");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取附件"));
    reader.readAsDataURL(file);
  });
}

export function EditorSurface() {
  const editor = useCreateBlockNote({ uploadFile: fileToDataURL });
  const [pageID, setPageID] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("document");
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [font, setFont] = useState<EditorFont>("sans");
  const [fullWidth, setFullWidth] = useState(false);
  const [saveState, setSaveState] = useState<SaveVisualState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const pageIDRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const iconRef = useRef("document");
  const revisionRef = useRef(0);
  const generationRef = useRef(0);
  const dirtyVersionRef = useRef(0);
  const lastSentDirtyVersionRef = useRef(0);
  const pendingRequestRef = useRef<string | null>(null);
  const pendingWaitersRef = useRef<Array<() => void>>([]);
  const saveTimerRef = useRef<number | null>(null);
  const applyingHostPageRef = useRef(false);
  const commitDraftRef = useRef<() => Promise<void>>(async () => undefined);
  const composingRef = useRef(false);
  const readyPostedRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!pageIDRef.current) return;
    dirtyVersionRef.current += 1;
    setSaveState("saving");
    postToHost({ version: 1, type: "dirty", pageID: pageIDRef.current });
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void commitDraftRef.current();
    }, 360);
  }, []);

  const markEditorDirty = useCallback(() => {
    if (applyingHostPageRef.current) return;
    markDirty();
  }, [markDirty]);

  const buildDraft = useCallback((): EditorDraft => ({
    version: 1,
    requestID: createRequestID(),
    pageID: pageIDRef.current ?? "",
    baseRevision: revisionRef.current,
    title: titleRef.current,
    icon: iconRef.current,
    content: editor.document as PartialBlock[],
  }), [editor]);

  const commitDraft = useCallback(async () => {
    if (!pageIDRef.current || pendingRequestRef.current || composingRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const draft = buildDraft();
    pendingRequestRef.current = draft.requestID;
    lastSentDirtyVersionRef.current = dirtyVersionRef.current;
    setSaveState("saving");
    postToHost({ ...draft, type: "change" });
  }, [buildDraft]);
  commitDraftRef.current = commitDraft;

  const waitForPending = useCallback(async () => {
    if (!pendingRequestRef.current) return;
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1800);
      pendingWaitersRef.current.push(() => {
        window.clearTimeout(timeout);
        resolve();
      });
    });
  }, []);

  const applyPreferences = useCallback((preferences: EditorPreferences) => {
    setAppearance(preferences.appearance);
    setFont(preferences.editorFont);
    setFullWidth(preferences.fullWidth);
    document.documentElement.dataset.theme = preferences.appearance;
    document.documentElement.dataset.editorFont = preferences.editorFont;
    document.documentElement.dataset.fullWidth = String(preferences.fullWidth);
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    document.documentElement.dataset.increaseContrast = String(preferences.increaseContrast);
    document.documentElement.style.colorScheme = preferences.appearance;
  }, []);

  const receivePage = useCallback((page: EditorPagePayload) => {
    if (page.version !== 1 || page.generation < generationRef.current) return;
    generationRef.current = page.generation;
    pageIDRef.current = page.pageID;
    revisionRef.current = page.revision;
    titleRef.current = page.title;
    iconRef.current = page.icon || "document";
    pendingRequestRef.current = null;
    dirtyVersionRef.current = 0;
    lastSentDirtyVersionRef.current = 0;
    pendingWaitersRef.current.splice(0).forEach((resolve) => resolve());
    setPageID(page.pageID);
    setTitle(page.title);
    setIcon(page.icon || "document");
    setSaveState("idle");
    setErrorMessage("");
    applyPreferences(page);
    const nextContent = page.content?.length ? page.content : EMPTY_CONTENT;
    applyingHostPageRef.current = true;
    editor.replaceBlocks(editor.document, nextContent);
    queueMicrotask(() => { applyingHostPageRef.current = false; });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".bn-editor")?.focus();
    });
  }, [applyPreferences, editor]);

  const receiveAcknowledgement = useCallback((acknowledgement: SaveAcknowledgement) => {
    if (acknowledgement.version !== 1 || acknowledgement.pageID !== pageIDRef.current) return;
    if (acknowledgement.requestID !== pendingRequestRef.current) return;
    pendingRequestRef.current = null;
    revisionRef.current = acknowledgement.revision;
    pendingWaitersRef.current.splice(0).forEach((resolve) => resolve());

    if (acknowledgement.status === "saved") {
      const changedAfterSend = dirtyVersionRef.current !== lastSentDirtyVersionRef.current;
      setSaveState(changedAfterSend ? "saving" : "saved");
      setErrorMessage("");
      if (changedAfterSend) {
        saveTimerRef.current = window.setTimeout(() => void commitDraft(), 120);
      }
      return;
    }

    setErrorMessage(acknowledgement.message ?? "保存失败，请重试。 ");
    setSaveState(acknowledgement.status === "conflict" ? "conflict" : "failed");
  }, [commitDraft]);

  const dispatchCommand = useCallback((command: { name: string }) => {
    if (!pageIDRef.current) return;
    const cursor = editor.getTextCursorPosition();
    switch (command.name) {
      case "bold": editor.toggleStyles({ bold: true }); break;
      case "italic": editor.toggleStyles({ italic: true }); break;
      case "strike": editor.toggleStyles({ strike: true }); break;
      case "code": editor.toggleStyles({ code: true }); break;
      case "heading1": editor.updateBlock(cursor.block, { type: "heading", props: { level: 1 } }); break;
      case "heading2": editor.updateBlock(cursor.block, { type: "heading", props: { level: 2 } }); break;
      case "heading3": editor.updateBlock(cursor.block, { type: "heading", props: { level: 3 } }); break;
      case "bulletList": editor.updateBlock(cursor.block, { type: "bulletListItem" }); break;
      case "numberedList": editor.updateBlock(cursor.block, { type: "numberedListItem" }); break;
      case "checkList": editor.updateBlock(cursor.block, { type: "checkListItem" }); break;
      case "blockquote": editor.updateBlock(cursor.block, { type: "quote" }); break;
      case "link": {
        document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
        break;
      }
      default: break;
    }
    markDirty();
  }, [editor, markDirty]);

  useEffect(() => {
    window.gooseEditor = {
      receivePage,
      receiveAcknowledgement,
      updatePreferences: applyPreferences,
      clear: () => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        pageIDRef.current = null;
        pendingRequestRef.current = null;
        pendingWaitersRef.current.splice(0).forEach((resolve) => resolve());
        setPageID(null);
        setSaveState("idle");
        setErrorMessage("");
      },
      dispatchCommand,
      flushAndGetDraft: async () => {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        await waitForPending();
        return buildDraft();
      },
      exportMarkdown: async () => ({
        title: titleRef.current.trim() || "未命名",
        markdown: await editor.blocksToMarkdownLossy(editor.document),
      }),
      importMarkdown: async (nextTitle: string, markdown: string) => {
        const blocks = await editor.tryParseMarkdownToBlocks(markdown);
        applyingHostPageRef.current = true;
        editor.replaceBlocks(editor.document, blocks.length ? blocks : EMPTY_CONTENT);
        queueMicrotask(() => { applyingHostPageRef.current = false; });
        titleRef.current = nextTitle;
        setTitle(nextTitle);
        dirtyVersionRef.current += 1;
        return buildDraft();
      },
    };
    if (!readyPostedRef.current) {
      readyPostedRef.current = true;
      postToHost({ version: 1, type: "ready" });
    }
  }, [applyPreferences, buildDraft, dispatchCommand, editor, receiveAcknowledgement, receivePage, waitForPending]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  const updateTitle = (value: string) => {
    titleRef.current = value;
    setTitle(value);
    markDirty();
  };

  const cycleIcon = () => {
    const index = ICONS.indexOf(iconRef.current);
    const next = ICONS[(index + 1) % ICONS.length];
    iconRef.current = next;
    setIcon(next);
    markDirty();
  };

  const retry = () => {
    setErrorMessage("");
    setSaveState("saving");
    void commitDraft();
  };

  const reload = () => {
    if (!pageIDRef.current) return;
    postToHost({ version: 1, type: "reloadRequest", pageID: pageIDRef.current });
  };

  return (
    <main
      className={`editor-surface editor-font-${font}${fullWidth ? " is-full-width" : ""}`}
      data-theme={appearance}
      data-testid="editor-surface"
    >
      {pageID ? (
        <>
          {(saveState === "failed" || saveState === "conflict") && (
            <div className="save-error" role="alert" data-testid="save-error">
              <AlertCircle aria-hidden="true" size={17} />
              <span>{errorMessage}</span>
              <button type="button" onClick={saveState === "conflict" ? reload : retry}>
                <RotateCcw aria-hidden="true" size={14} />
                {saveState === "conflict" ? "重新载入" : "重试"}
              </button>
            </div>
          )}
          <article className="editor-page" aria-label="当前页面">
            <button className="page-icon" type="button" onClick={cycleIcon} aria-label="更换页面图标">
              {icon === "document" ? <FileText aria-hidden="true" size={29} /> : icon}
            </button>
            <textarea
              className="page-title"
              value={title}
              rows={1}
              aria-label="页面标题"
              placeholder="未命名"
              spellCheck
              onChange={(event) => updateTitle(event.target.value)}
              onInput={(event) => {
                const field = event.currentTarget;
                field.style.height = "auto";
                field.style.height = `${field.scrollHeight}px`;
              }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => {
                composingRef.current = false;
                markDirty();
              }}
            />
            <BlockNoteView
              editor={editor}
              theme={appearance}
              onChange={markEditorDirty}
            />
          </article>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {saveState === "saving" ? "正在保存" : saveState === "saved" ? "已保存" : ""}
          </p>
        </>
      ) : (
        <div className="editor-placeholder" aria-label="未选择页面">
          <FileText aria-hidden="true" size={34} />
          <p>选择一个页面开始写作</p>
        </div>
      )}
    </main>
  );
}
