import { useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";

/**
 * Hook to return whether the user is currently scrolling or has recently scrolled.
 * Useful for hiding floating menus while scrolling.
 * 
 * @param editor - Optional editor instance to listen for selection updates (to show menu again)
 */
export function useScrollHide(editor?: Editor | null) {
  const [isHidden, setIsHidden] = useState(false);
  const ignoreScrollUntilRef = useRef(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      // 如果在忽略期内（例如选中导致自动滚动），不隐藏菜单
      if (Date.now() < ignoreScrollUntilRef.current) {
        return;
      }
      setIsHidden(true);
    };

    // Use capture to catch scroll events from any container
    window.addEventListener("scroll", handleScroll, { capture: true });

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  // Restore visibility when selection changes or editor content updates
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setIsHidden(false);
      // 给一个 500ms 的"静默期"，选中导致页面滚动时不会立即隐藏菜单
      ignoreScrollUntilRef.current = Date.now() + 500;
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("focus", handleUpdate);
    
    // 初始化时也调用一次，确保如果有选中状态且无滚动时显示
    handleUpdate();

    return () => {
      editor.off("selectionUpdate", handleUpdate);
      editor.off("focus", handleUpdate);
    };
  }, [editor]);

  return isHidden;
}
