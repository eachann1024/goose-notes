import { useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";

/**
 * Hook to return whether the user is currently scrolling or has recently scrolled.
 * Useful for hiding floating menus while scrolling.
 *
 * @param editor - Optional editor instance to listen for selection updates (to show menu again)
 */
export function useScrollHide(
  editor?: Editor | null,
  options?: { ignoreAfterSelectionMs?: number },
) {
  const [isHidden, setIsHidden] = useState(false);
  const ignoreScrollUntilRef = useRef(0);
  const ignoreAfterSelectionMs = options?.ignoreAfterSelectionMs ?? 500;

  useEffect(() => {
    return subscribeGlobalScrollActivity((nextSnapshot) => {
      if (!nextSnapshot.isScrolling) return;
      if (Date.now() < ignoreScrollUntilRef.current) return;
      setIsHidden((prev) => (prev ? prev : true));
    });
  }, []);

  // Restore visibility when selection changes or editor content updates
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setIsHidden((prev) => (prev ? false : prev));
      // 给一个短暂"静默期"，选中导致页面滚动时不会立即隐藏菜单
      ignoreScrollUntilRef.current = Date.now() + ignoreAfterSelectionMs;
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("focus", handleUpdate);

    // 初始化时也调用一次，确保如果有选中状态且无滚动时显示
    handleUpdate();

    return () => {
      editor.off("selectionUpdate", handleUpdate);
      editor.off("focus", handleUpdate);
    };
  }, [editor, ignoreAfterSelectionMs]);

  return isHidden;
}
