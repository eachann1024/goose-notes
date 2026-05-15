import { useEffect, useState, useCallback } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
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

  const visit = (block: any) => {
    if (block.type === "heading" && block.props?.level) {
      const level = block.props.level;
      // 仅记录 h1-h4
      if (level >= 2 && level <= 4) {
        const item: HeadingItem = {
          id: block.id,
          level,
          text: extractTextFromBlock(block) || "无标题",
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
    setHeadings(collectHeadings(doc));
  }, [editor]);

  useEffect(() => {
    refresh();
  }, [refresh, pageId]);

  useEffect(() => {
    if (!editor) return;
    const unsub = editor.onChange?.(() => {
      refresh();
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [editor, refresh]);

  return headings;
}
