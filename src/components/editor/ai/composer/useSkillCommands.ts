import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { LocalSkill } from "@/lib/notebook-ai/localContext";
import {
  searchComposerSlashItems,
  type ComposerSlashBuiltinId,
  type ComposerSlashItem,
} from "@/lib/notebook-ai/composerSlashCommands";
import { isSuggestionMenuAcceptKey } from "@/components/editor/utils/slashMenuPolicy";
import type { AiSkillCommandAttrs } from "./referenceLookup";

import {
  detectCommandAtCaret,
  type DetectedCommand,
} from "./composerCommandDetection";
import { createSkillChipElement } from "./composerSkillChip";
import {
  pruneEmptyComposerTextNodes,
  ensureComposerCaretAnchors,
  placeCaretAfterNode,
} from "./composerCaret";
export * from "./composerCaret";
export {
  parseSlashCommandBeforeCaret,
  getComposerCaretTextContext,
} from "./composerCommandDetection";
export { createSkillChipElement } from "./composerSkillChip";

const INACTIVE = {
  active: false,
  query: "",
  anchorRect: null as DOMRect | null,
  activeIndex: 0,
};

function toSkillAttrs(skill: LocalSkill): AiSkillCommandAttrs {
  return {
    name: skill.name,
    path: skill.path,
    description: skill.description,
  };
}

export function useSkillCommands(options: {
  editorRef: RefObject<HTMLDivElement | null>;
  isComposingRef: RefObject<boolean>;
  notebookId?: string;
  enabled: boolean;
  includeSkills: boolean;
  onContentMutation: () => void;
  onBuiltinCommand?: (id: ComposerSlashBuiltinId) => void;
}) {
  const {
    editorRef,
    isComposingRef,
    notebookId,
    enabled,
    includeSkills,
    onContentMutation,
    onBuiltinCommand,
  } = options;
  const lastDetectedRef = useRef<DetectedCommand | null>(null);
  const [command, setCommand] = useState(INACTIVE);
  const items = useMemo(
    () =>
      enabled && command.active
        ? searchComposerSlashItems(command.query, {
            notebookId,
            includeSkills,
          })
        : [],
    [command.active, command.query, enabled, includeSkills, notebookId],
  );
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
      anchorRect:
        rect.width || rect.height ? rect : editor.getBoundingClientRect(),
      activeIndex: detected.query === previous.query ? previous.activeIndex : 0,
    }));
  }, [clearCommandState, editorRef, enabled, isComposingRef]);

  const insertCommand = useCallback(
    (item: ComposerSlashItem) => {
      const editor = editorRef.current;
      const detected =
        lastDetectedRef.current ??
        (editor ? detectCommandAtCaret(editor) : null);
      clearCommandState();

      if (item.kind === "builtin") {
        if (editor && detected) {
          try {
            detected.range.deleteContents();
            if (item.id === "new") {
              editor.replaceChildren();
            }
            pruneEmptyComposerTextNodes(editor);
            ensureComposerCaretAnchors(editor);
            editor.focus();
          } catch {
            // 清掉 /query 失败也不阻断指令执行
          }
          onContentMutation();
        }
        onBuiltinCommand?.(item.id);
        return;
      }

      if (!editor || !detected) return;

      try {
        detected.range.deleteContents();
        // 间距靠 CSS；插入后用 ZWSP 锚点保证旧 Chromium 光标可见。
        const chip = createSkillChipElement(toSkillAttrs(item.skill));
        detected.range.insertNode(chip);
        pruneEmptyComposerTextNodes(editor);
        ensureComposerCaretAnchors(editor);
        editor.focus();
        placeCaretAfterNode(chip);
      } catch {
        return;
      }

      onContentMutation();
    },
    [clearCommandState, editorRef, onBuiltinCommand, onContentMutation],
  );

  const handleCommandKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!command.active) return false;
      const currentItems = itemsRef.current;
      const count = Math.max(1, currentItems.length);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setCommand((previous) => ({
          ...previous,
          activeIndex: (previous.activeIndex + delta + count) % count,
        }));
        return true;
      }
      if (isSuggestionMenuAcceptKey(event)) {
        const item = currentItems[command.activeIndex];
        if (!item) {
          if (event.key === "Tab") {
            event.preventDefault();
            return true;
          }
          clearCommandState();
          return false;
        }
        event.preventDefault();
        insertCommand(item);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearCommandState();
        return true;
      }
      return false;
    },
    [clearCommandState, command.active, command.activeIndex, insertCommand],
  );

  return {
    command,
    items,
    detectCommand,
    insertCommand,
    handleCommandKeyDown,
    clearCommandState,
  };
}
