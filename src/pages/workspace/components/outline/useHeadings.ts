import { useEffect, useState, useCallback } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
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
  const headings: HeadingItem[] = [];

  const visit = (block: any) => {
    if (block.type === "heading" && block.props?.level) {
      const level = block.props.level;
      // 只显示 h2 和 h3，h1 是页面标题
      if (level >= 2 && level <= 3) {
        headings.push({
          id: block.id,
          level,
          text: extractTextFromBlock(block) || "无标题",
        });
      }
    }
    if (block.children?.length) {
      for (const child of block.children) visit(child);
    }
  };

  for (const block of doc) visit(block);
  return headings;
}

export function useHeadings(editor: BlockNoteEditor | null) {
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
  }, [refresh]);

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
