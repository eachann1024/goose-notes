import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import {
  armSidebarListCollapse,
  tryCollapseSidebarListOnEscape,
} from "@/lib/sidebarListCollapse";
import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";

interface UseSidebarEffectsOptions {
  activePageId?: string | null | undefined;
  activeNotebookId?: string | null | undefined;
  currentView: string;
  onOpenSettings: (tab?: "general" | "appearance" | "ai" | "data") => void;
}

export function useSidebarEffects({
  activeNotebookId,
  currentView,
  onOpenSettings,
}: UseSidebarEffectsOptions) {
  const resolveDeleteTargetPageId = useCallback(
    (target: Element | null) => {
      const activePageId = usePages.getState().activePageId;
      const isInSidebarTree = !!target?.closest(".rct-main-tree");
      if (!isInSidebarTree || !activeNotebookId) return activePageId;

      const view = useSidebarView.getState();
      const candidateIds = [
        view.focusedByNotebook[activeNotebookId] ?? null,
        view.selectedByNotebook[activeNotebookId] ?? null,
        activePageId,
      ];

      for (const candidateId of candidateIds) {
        if (!candidateId || candidateId === "root") continue;
        const page = usePages.getState().pages[candidateId];
        if (!page || page.trashedAt) continue;
        if (page.workspaceId !== activeNotebookId) continue;
        return candidateId;
      }

      return activePageId;
    },
    [activeNotebookId],
  );

  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const isInEditor =
        (target instanceof HTMLElement && target.isContentEditable) ||
        !!target?.closest(".bn-editor") ||
        !!target?.closest("[data-ai-composer-editor]") ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        const deleteTargetPageId = resolveDeleteTargetPageId(target);
        if (deleteTargetPageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          void deletePageWithUndo(deleteTargetPageId);
        }
      }
    },
    [currentView, resolveDeleteTargetPageId],
  );

  const handleSidebarListEscape = useCallback(
    (event: KeyboardEvent) => {
      if (isImeKeyboardEvent(event)) return;
      if (currentView !== "pages") return;
      if (
        !tryCollapseSidebarListOnEscape(event, activeNotebookId)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [activeNotebookId, currentView],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      armSidebarListCollapse(event.target);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", handleDeleteShortcut);
    document.addEventListener("keydown", handleSidebarListEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", handleDeleteShortcut);
      document.removeEventListener("keydown", handleSidebarListEscape, true);
    };
  }, [handleDeleteShortcut, handleSidebarListEscape]);

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: "general" | "appearance" | "ai" | "data" }>;
      onOpenSettings(customEvent.detail?.tab);
      if (customEvent.detail?.tab) {
        window.dispatchEvent(
          new CustomEvent("goose-note:settings-tab-change", {
            detail: { tab: customEvent.detail.tab },
          }),
        );
      }
    };

    window.addEventListener("goose-note:open-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("goose-note:open-settings", handleOpenSettings);
    };
  }, [onOpenSettings]);
}
