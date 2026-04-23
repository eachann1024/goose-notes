import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";

export function useScrollHide(
  editor?: Editor | null,
  options?: { ignoreAfterSelectionMs?: number; typingHideMs?: number },
) {
  const [isHidden, setIsHidden] = useState(false);
  const ignoreScrollUntilRef = useRef(0);
  const typingUntilRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreAfterSelectionMs = options?.ignoreAfterSelectionMs ?? 500;
  const typingHideMs = options?.typingHideMs ?? 700;

  const clearTypingTimer = useCallback(() => {
    if (!typingTimerRef.current) return;
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
  }, []);

  const hideForTyping = useCallback(() => {
    typingUntilRef.current = Date.now() + typingHideMs;
    setIsHidden((prev) => (prev ? prev : true));
    clearTypingTimer();
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      if (Date.now() < typingUntilRef.current) return;
      setIsHidden(false);
    }, typingHideMs);
  }, [clearTypingTimer, typingHideMs]);

  useEffect(() => {
    return subscribeGlobalScrollActivity((nextSnapshot) => {
      if (!nextSnapshot.isScrolling) return;
      if (Date.now() < ignoreScrollUntilRef.current) return;
      setIsHidden((prev) => (prev ? prev : true));
    });
  }, []);

  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    const handleUpdate = () => {
      if (Date.now() < typingUntilRef.current) return;
      setIsHidden((prev) => (prev ? false : prev));
      ignoreScrollUntilRef.current = Date.now() + ignoreAfterSelectionMs;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key === "Process" || event.keyCode === 229) {
        hideForTyping();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1 && event.key !== "Backspace" && event.key !== "Delete" && event.key !== "Enter") {
        return;
      }
      hideForTyping();
    };
    const handlePaste = () => {
      hideForTyping();
    };
    const handleCompositionStart = () => {
      hideForTyping();
    };
    const handleCompositionEnd = () => {
      hideForTyping();
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("focus", handleUpdate);
    editorElement.addEventListener("keydown", handleKeyDown, true);
    editorElement.addEventListener("paste", handlePaste, true);
    editorElement.addEventListener("compositionstart", handleCompositionStart, true);
    editorElement.addEventListener("compositionend", handleCompositionEnd, true);

    handleUpdate();

    return () => {
      clearTypingTimer();
      editor.off("selectionUpdate", handleUpdate);
      editor.off("focus", handleUpdate);
      editorElement.removeEventListener("keydown", handleKeyDown, true);
      editorElement.removeEventListener("paste", handlePaste, true);
      editorElement.removeEventListener("compositionstart", handleCompositionStart, true);
      editorElement.removeEventListener("compositionend", handleCompositionEnd, true);
    };
  }, [editor, clearTypingTimer, hideForTyping, ignoreAfterSelectionMs]);

  return isHidden;
}
