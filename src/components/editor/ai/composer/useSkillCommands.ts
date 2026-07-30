import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { searchLocalSkills, type LocalSkill } from "@/lib/notebook-ai/localContext";

interface DetectedCommand {
  query: string;
  range: Range;
}

const INACTIVE = { active: false, query: "", anchorRect: null as DOMRect | null, activeIndex: 0 };

function detectCommandAtCaret(container: HTMLElement): DetectedCommand | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return null;
  const anchor = selection.anchorNode;
  if (!anchor || anchor.nodeType !== Node.TEXT_NODE || !container.contains(anchor)) return null;
  const beforeCaret = (anchor.textContent ?? "").slice(0, selection.anchorOffset);
  const slashIndex = beforeCaret.lastIndexOf("/");
  // Skill 命令只允许作为整条输入的第一个非空内容，和发送解析保持一致。
  if (slashIndex === -1 || beforeCaret.slice(0, slashIndex).trim()) return null;
  const query = beforeCaret.slice(slashIndex + 1);
  if (/\s/.test(query)) return null;
  const range = document.createRange();
  range.setStart(anchor, slashIndex);
  range.setEnd(anchor, selection.anchorOffset);
  return { query, range };
}

export function useSkillCommands(options: {
  editorRef: RefObject<HTMLDivElement | null>;
  isComposingRef: RefObject<boolean>;
  enabled: boolean;
  onContentMutation: () => void;
}) {
  const { editorRef, isComposingRef, enabled, onContentMutation } = options;
  const lastDetectedRef = useRef<DetectedCommand | null>(null);
  const [command, setCommand] = useState(INACTIVE);
  const items = useMemo(
    () => (enabled && command.active ? searchLocalSkills(command.query) : []),
    [command.active, command.query, enabled],
  );
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const clearCommandState = useCallback(() => {
    lastDetectedRef.current = null;
    setCommand(INACTIVE);
  }, []);

  const detectCommand = useCallback(() => {
    if (!enabled) return clearCommandState();
    const editor = editorRef.current;
    if (!editor || isComposingRef.current) return;
    const detected = detectCommandAtCaret(editor);
    if (!detected) return clearCommandState();
    lastDetectedRef.current = detected;
    const rect = detected.range.getBoundingClientRect();
    setCommand((previous) => ({
      active: true,
      query: detected.query,
      anchorRect: rect.width || rect.height ? rect : editor.getBoundingClientRect(),
      activeIndex: detected.query === previous.query ? previous.activeIndex : 0,
    }));
  }, [clearCommandState, editorRef, enabled, isComposingRef]);

  const insertCommand = useCallback((skill: LocalSkill) => {
    const editor = editorRef.current;
    const detected = lastDetectedRef.current ?? (editor ? detectCommandAtCaret(editor) : null);
    clearCommandState();
    if (!editor || !detected) return;
    detected.range.deleteContents();
    const text = document.createTextNode(`/${skill.name} `);
    detected.range.insertNode(text);
    const caret = document.createRange();
    caret.setStart(text, text.length);
    caret.collapse(true);
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    onContentMutation();
  }, [clearCommandState, editorRef, onContentMutation]);

  const handleCommandKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!command.active) return false;
    const currentItems = itemsRef.current;
    const count = Math.max(1, currentItems.length);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setCommand((previous) => ({ ...previous, activeIndex: (previous.activeIndex + delta + count) % count }));
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      const skill = currentItems[command.activeIndex];
      if (!skill) {
        clearCommandState();
        return false;
      }
      event.preventDefault();
      insertCommand(skill);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearCommandState();
      return true;
    }
    return false;
  }, [clearCommandState, command.active, command.activeIndex, insertCommand]);

  return { command, items, detectCommand, insertCommand, handleCommandKeyDown, clearCommandState };
}
