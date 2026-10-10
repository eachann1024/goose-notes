import { useCallback, useEffect, useRef, useState } from "react";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { indentCodeSelection } from "./codeBlockIndent";
import {
  getCodeDomSelection,
  isComposingKeyboardEvent,
  setCodeDomSelectionOffsets,
} from "./codeDomSelection";

export function useCodeBlockEdit({
  block,
  contentRef,
  editor,
  isEditable,
  summary,
  collapsed,
  onDefaultCodeBlockWrapChange,
}: {
  block: any;
  contentRef: any;
  editor: any;
  isEditable: boolean;
  summary: string;
  collapsed: boolean;
  onDefaultCodeBlockWrapChange: (wrap: boolean) => void;
}) {
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const getCodeContent = useCallback(() => {
    const content = block.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((c: any) => c?.text ?? "").join("");
    }
    // Walk inline content via DOM
    const el = contentRef.current;
    if (el) return el.textContent || "";
    return "";
  }, [block.content, contentRef]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      editor.updateBlock(block.id, { props: { language: lang } });
    },
    [editor, block.id],
  );

  const handleWrapChange = useCallback(
    (w: boolean) => {
      onDefaultCodeBlockWrapChange(w);
      editor.updateBlock(block.id, { props: { wrap: w } });
    },
    [editor, block.id, onDefaultCodeBlockWrapChange],
  );

  const normalizeSummary = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

  const handleSummaryCommit = useCallback(() => {
    const next = normalizeSummary(summaryDraft);
    if (next !== summary) {
      editor.updateBlock(block.id, { props: { summary: next } });
    }
    setSummaryDraft(next);
    setIsEditingSummary(false);
  }, [summaryDraft, summary, editor, block.id]);

  const handleCollapsedChange = useCallback(() => {
    editor.updateBlock(block.id, { props: { collapsed: !collapsed } });
  }, [editor, block.id, collapsed]);

  const handleFormat = useCallback(
    (formatted: string) => {
      // BlockNote: update block content by replacing all text
      const currentContent = block.content;
      if (Array.isArray(currentContent) && currentContent.length > 0) {
        editor.updateBlock(block.id, {
          content: [{ type: "text", text: formatted, styles: {} }],
        });
      }
    },
    [editor, block.id, block.content],
  );

  const insertTextAtCursor = useCallback((text: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLPreElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        insertTextAtCursor(text.replace(/\r\n/g, "\n"));
      }
    },
    [insertTextAtCursor],
  );

  useEffect(() => {
    if (!isEditable) return;

    const applyTabIndent = (event: KeyboardEvent | React.KeyboardEvent) => {
      if (isWorkspaceSettingsOpen()) return;
      if (event.key !== "Tab" || isComposingKeyboardEvent(event)) return;
      const domSelection = getCodeDomSelection();
      if (!domSelection || !rootRef.current?.contains(domSelection.codeElement))
        return;

      const next = indentCodeSelection(
        domSelection.text,
        domSelection.start,
        domSelection.end,
        {
          outdent: event.shiftKey,
        },
      );
      event.preventDefault();
      event.stopPropagation();
      editor.updateBlock(block.id, { content: next.text });
      window.requestAnimationFrame(() => {
        const codeElement = rootRef.current?.querySelector<HTMLElement>(
          ".goose-code-content",
        );
        if (codeElement) {
          setCodeDomSelectionOffsets(
            codeElement,
            next.selectionStart,
            next.selectionEnd,
          );
        }
      });
      if ("stopImmediatePropagation" in event) {
        event.stopImmediatePropagation();
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      applyTabIndent(event);
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      applyTabIndent(event);
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
    };
  }, [block.id, editor, isEditable]);

  const handleCodeKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab" || isComposingKeyboardEvent(event) || !isEditable)
        return;
      const domSelection = getCodeDomSelection();
      if (!domSelection || !rootRef.current?.contains(domSelection.codeElement))
        return;

      const next = indentCodeSelection(
        domSelection.text,
        domSelection.start,
        domSelection.end,
        {
          outdent: event.shiftKey,
        },
      );
      event.preventDefault();
      event.stopPropagation();
      editor.updateBlock(block.id, { content: next.text });
      window.requestAnimationFrame(() => {
        const codeElement = rootRef.current?.querySelector<HTMLElement>(
          ".goose-code-content",
        );
        if (codeElement) {
          setCodeDomSelectionOffsets(
            codeElement,
            next.selectionStart,
            next.selectionEnd,
          );
        }
      });
    },
    [block.id, editor, isEditable],
  );

  useEffect(() => {
    if (!isEditingSummary) return;
    const timer = setTimeout(() => {
      summaryInputRef.current?.focus();
      summaryInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [isEditingSummary]);

  return {
    rootRef,
    summaryInputRef,
    isEditingSummary,
    setIsEditingSummary,
    summaryDraft,
    setSummaryDraft,
    getCodeContent,
    handleLanguageChange,
    handleWrapChange,
    handleSummaryCommit,
    handleCollapsedChange,
    handleFormat,
    handlePaste,
    handleCodeKeyDownCapture,
  };
}
