import { useEffect } from "react";
import { countLeaves } from "@/lib/editor-split/tree";
import { useEditorSplitSelector } from "@/stores/useEditorSplit";
import type { useWorkspaceAiNavigation } from "./useWorkspaceAiNavigation";

export function useWorkspaceScrollSync(
  input: ReturnType<typeof useWorkspaceAiNavigation>,
) {
  const { scrollContainerRef, activeTabId, showFullscreenAi, paneRegistry } =
    input;

  const splitLeafCount = useEditorSplitSelector((state) => {
    if (!activeTabId) return 0;
    const split = state.byTabId[activeTabId];
    return split ? countLeaves(split.root) : 0;
  }, Object.is);

  // 全屏打开后再给编辑区打 inert，避开点击帧对 BlockNote 大树做无障碍更新
  useEffect(() => {
    const fromPanes = paneRegistry?.getScrollElements() ?? [];
    const fallback = scrollContainerRef.current;
    const targets =
      fromPanes.length > 0 ? fromPanes : fallback ? [fallback] : [];
    if (targets.length === 0) return;
    if (!showFullscreenAi) {
      for (const el of targets) {
        el.inert = false;
        el.classList.remove("invisible");
      }
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      for (const el of targets) {
        el.inert = true;
        el.classList.add("invisible");
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      for (const el of targets) {
        el.inert = false;
        el.classList.remove("invisible");
      }
    };
  }, [showFullscreenAi, scrollContainerRef, paneRegistry, splitLeafCount]);
  return { ...input, splitLeafCount };
}
