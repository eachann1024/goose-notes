import { useEffect, useState, useCallback } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { isFoldableHeadingBlock } from "@/components/editor/core/headingSectionFold";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  isCollapsed: boolean;
  isEditorFoldable: boolean;
  children: HeadingItem[];
}

function extractTextFromBlock(block: any): string {
  if (!block.content) return "";
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((inline: any) => {
        if (typeof inline === "string") return inline;
        if (inline?.text) return inline.text;
        return "";
      })
      .join("");
  }
  return "";
}

function collectHeadings(doc: any[]): HeadingItem[] {
  const roots: HeadingItem[] = [];
  const stack: HeadingItem[] = [];
  const firstBlockId = doc[0]?.id as string | undefined;

  const visit = (block: any) => {
    if (block.type === "heading" && block.props?.level) {
      const level = block.props.level;
      // 仅记录 h1-h4
      if (level >= 2 && level <= 4) {
        const item: HeadingItem = {
          id: block.id,
          level,
          text: extractTextFromBlock(block) || "无标题",
          // 标题折叠的唯一数据来源是 BlockNote heading.props.collapsed。
          // 兼容旧内容可能留下的字符串值，和编辑器折叠扩展保持一致。
          isCollapsed:
            block.props?.collapsed === true || block.props?.collapsed === "true",
          isEditorFoldable: isFoldableHeadingBlock(block, firstBlockId),
          children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(item);
        } else {
          roots.push(item);
        }
        stack.push(item);
      }
    }
    if (block.children?.length) {
      for (const child of block.children) visit(child);
    }
  };

  for (const block of doc) visit(block);
  return roots;
}

function headingsEqual(left: HeadingItem[], right: HeadingItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((heading, index) => {
    const other = right[index];
    return (
      heading.id === other.id &&
      heading.level === other.level &&
      heading.text === other.text &&
      heading.isCollapsed === other.isCollapsed &&
      heading.isEditorFoldable === other.isEditorFoldable &&
      headingsEqual(heading.children, other.children)
    );
  });
}

export function useHeadings(
  editor: BlockNoteEditor | null,
  pageId?: string | null,
) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const refresh = useCallback(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }
    const doc = editor.document as any[];
    const nextHeadings = collectHeadings(doc);
    // 非标题编辑同样会触发 editor.onChange；内容未变时沿用旧引用，
    // 避免大纲面板的无关重渲染。标题文案、层级或收起状态变化仍会立即更新。
    setHeadings((current) =>
      headingsEqual(current, nextHeadings) ? current : nextHeadings,
    );
  }, [editor]);

  useEffect(() => {
    refresh();
  }, [refresh, pageId]);

  useEffect(() => {
    if (!editor) return;
    // IME composition 期间每个拼音中间态都会触发 onChange，这里调 editor.document
    // 全量转换 + collectHeadings 遍历全文 + setHeadings 触发大纲面板重渲染，
    // 高频叠加会与 PM composition 抢主线程导致输入卡顿。composition 中跳过，
    // compositionend 后刷新一次即可（大纲对中间态不可见，无功能损失）。
    const isComposing = () =>
      Boolean(
        (editor as { prosemirrorView?: { composing?: boolean } }).prosemirrorView
          ?.composing,
      );
    const unsub = editor.onChange?.(() => {
      if (isComposing()) return;
      refresh();
    });
    const dom = (editor as { prosemirrorView?: { dom?: HTMLElement } })
      .prosemirrorView?.dom;
    const handleCompositionEnd = () => {
      requestAnimationFrame(() => refresh());
    };
    dom?.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      if (typeof unsub === "function") unsub();
      dom?.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [editor, refresh]);

  return headings;
}
