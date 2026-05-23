import { useDeletePageWithUndo } from "@/hooks/useDeletePageWithUndo";

interface UseSidebarEffectsOptions {
  activePageId: string | null | undefined;
  currentView: string;
  isAiPageOpen: boolean;
  onAiPageOpenWithOutline: () => void;
  onOpenSettings: (tab?: "general" | "appearance" | "ai" | "data") => void;
}

export function useSidebarEffects({
  activePageId,
  currentView,
  isAiPageOpen,
  onAiPageOpenWithOutline,
  onOpenSettings,
}: UseSidebarEffectsOptions) {
  const { deletePageWithUndo } = useDeletePageWithUndo();

  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        const target = e.target as HTMLElement;
        const isInEditor =
          target.closest(".bn-editor") ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA";

        if (activePageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          void deletePageWithUndo(activePageId);
        }
      }
    },
    [activePageId, currentView, deletePageWithUndo],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleDeleteShortcut);
    return () => {
      document.removeEventListener("keydown", handleDeleteShortcut);
    };
  }, [handleDeleteShortcut]);

  useEffect(() => {
    if (isAiPageOpen && currentView === "outline") {
      onAiPageOpenWithOutline();
    }
  }, [isAiPageOpen, currentView, onAiPageOpenWithOutline]);

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
