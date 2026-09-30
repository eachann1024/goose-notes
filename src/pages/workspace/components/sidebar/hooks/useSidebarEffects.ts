import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { usePages } from "@/stores/usePages";

interface UseSidebarEffectsOptions {
  activePageId?: string | null | undefined;
  currentView: string;
  onOpenSettings: (tab?: "general" | "appearance" | "ai" | "data") => void;
}

export function useSidebarEffects({
  currentView,
  onOpenSettings,
}: UseSidebarEffectsOptions) {
  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInEditor =
        target.isContentEditable ||
        target.closest(".bn-editor") ||
        target.closest("[data-ai-composer-editor]") ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        const currentActivePageId = usePages.getState().activePageId;
        if (currentActivePageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          void deletePageWithUndo(currentActivePageId);
        }
      }
    },
    [currentView],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleDeleteShortcut);
    return () => {
      document.removeEventListener("keydown", handleDeleteShortcut);
    };
  }, [handleDeleteShortcut]);

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
