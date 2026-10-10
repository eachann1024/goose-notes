import type { JSONContent } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AiComposerInputHandle } from "@/components/editor/ai/composer/AiComposerInput";
import { isEditorDomEmpty } from "@/components/editor/ai/composer/composerChipDom";
import {
  measureNowrapContentSize,
  measureSingleLineSlot,
  shouldExpandComposer,
} from "@/components/editor/ai/composer/composerExpandLayout";
import {
  composerDraftHasContent,
  useNotebookAiChats,
} from "@/stores/useNotebookAiChats";
import type { ComposerProps } from "./types";
export function useComposerSurface({
  notebookId,
  initialContent,
  disabled,
}: ComposerProps) {
  const inputRef = useRef<AiComposerInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoFocusToken, setAutoFocusToken] = useState(disabled ? 0 : 1);
  // 仅在挂载时读一次草稿作种子；运行中由 onContentChange 写回 store，
  // 避免把 store 回灌成受控值导致 contenteditable 选区被重建。
  const [seedContent] = useState<JSONContent | null>(() =>
    initialContent !== undefined
      ? initialContent
      : useNotebookAiChats.getState().getComposerDraft(notebookId),
  );
  // 切回面板时草稿已在 DOM 水合前就决定发送按钮高亮，避免先暗后亮。
  const [isEmpty, setIsEmpty] = useState(
    () => !composerDraftHasContent(seedContent),
  );
  // 输入区超一行 → data-multiline 标记（高度由 --ai-composer-h 管）
  const [multiline, setMultiline] = useState(false);
  // chrome 两行展开：内容到模型选择器位置或有硬换行时，输入独占上行
  const [expanded, setExpanded] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const plusWrapRef = useRef<HTMLSpanElement | null>(null);
  const modelWrapRef = useRef<HTMLSpanElement | null>(null);
  const sendWrapRef = useRef<HTMLSpanElement | null>(null);
  const expandedRef = useRef(false);

  const collapseChrome = useCallback(() => {
    if (!expandedRef.current) {
      setMultiline(false);
      return;
    }
    expandedRef.current = false;
    setExpanded(false);
    setMultiline(false);
  }, []);

  /**
   * 展开判断永远用「单行槽宽度」，不用展开后的全宽，避免
   * 「展开变宽 → 文字缩回一行 → 收起」来回振荡。
   * 空 payload 不等于单行：Shift+Enter 留下的空行也展开，单个占位 br 收回。
   */
  const recomputeExpanded = useCallback(() => {
    const shell = shellRef.current;
    const el = inputRef.current?.getEditorEl();
    if (!shell || !el) return;
    const content = measureNowrapContentSize(el, shell);
    const next = shouldExpandComposer({
      isEmpty: isEditorDomEmpty(el),
      contentWidth: content.width,
      slotWidth: measureSingleLineSlot({
        shell,
        plusWidth: plusWrapRef.current?.offsetWidth ?? 0,
        modelWidth: modelWrapRef.current?.offsetWidth ?? 0,
        sendWidth: sendWrapRef.current?.offsetWidth ?? 0,
      }),
      // 不读取受当前软换行/固定高度影响的 live scrollHeight。
      scrollHeight: content.height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight) || 24,
    });
    if (expandedRef.current !== next) {
      expandedRef.current = next;
      setExpanded(next);
    }
  }, []);

  // 侧栏拖宽、换模型名导致 chrome 变宽 → 重算
  useEffect(() => {
    const nodes = [
      shellRef.current,
      plusWrapRef.current,
      modelWrapRef.current,
      sendWrapRef.current,
    ].filter((node): node is HTMLElement => node != null);
    if (nodes.length === 0) return;
    const observer = new ResizeObserver(() => recomputeExpanded());
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [recomputeExpanded]);

  return {
    inputRef,
    fileInputRef,
    autoFocusToken,
    setAutoFocusToken,
    seedContent,
    isEmpty,
    setIsEmpty,
    multiline,
    setMultiline,
    expanded,
    shellRef,
    plusWrapRef,
    modelWrapRef,
    sendWrapRef,
    collapseChrome,
    recomputeExpanded,
  };
}
export type ComposerSurfaceState = ReturnType<typeof useComposerSurface>;
