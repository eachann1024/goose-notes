/**
 * useTreeSelection.ts
 * 管理侧边树的节点展开/折叠状态（openPageIds），
 * 以及响应 expandPageId 信号自动展开并滚动到目标节点。
 */
import { useCallback, useEffect, useState } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { usePages } from "@/stores/usePages";
import type { VisibleTreeItem } from "../tree-dnd";

interface UseTreeSelectionOptions {
  activeNotebookId: string | null;
  renderItems: VisibleTreeItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

interface UseTreeSelectionReturn {
  openPageIds: Set<string>;
  handleToggle: (id: string) => void;
  /** 批量打开指定节点（用于拖拽嵌套后自动展开父节点等场景） */
  openPageId: (id: string) => void;
  /** 批量关闭指定节点（用于拖拽后清理空父节点等场景） */
  closePageId: (id: string) => void;
}

export function useTreeSelection({
  activeNotebookId,
  renderItems,
  virtualizer,
}: UseTreeSelectionOptions): UseTreeSelectionReturn {
  const { pages, expandPageId, setExpandPageId } = usePages();
  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openPageId = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const closePageId = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // 响应 expandPageId 信号：展开所有祖先节点并滚动到目标
  useEffect(() => {
    if (!expandPageId) return;

    const page = pages[expandPageId];
    if (!page) return;
    if (page.trashedAt) {
      setExpandPageId(null);
      return;
    }
    if (activeNotebookId && page.workspaceId !== activeNotebookId) {
      return;
    }

    const ancestorIds: string[] = [];
    let current = page;
    while (current.parentId && pages[current.parentId]) {
      ancestorIds.push(current.parentId);
      current = pages[current.parentId];
    }

    setOpenPageIds((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });

    const timer = window.setTimeout(() => {
      const index = renderItems.findIndex((item) => item.id === expandPageId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    }, 80);

    setExpandPageId(null);
    return () => window.clearTimeout(timer);
  }, [expandPageId, pages, activeNotebookId, setExpandPageId, renderItems, virtualizer]);

  return { openPageIds, handleToggle, openPageId, closePageId };
}
