import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { usePages } from "@/stores/usePages";

interface UseSidebarEffectsOptions {
  /** 仅为调用方接口兼容保留；删除时改为直读 store 最新值，避免连续删除的闭包陈值。 */
  activePageId?: string | null | undefined;
  currentView: string;
  isAiPageOpen: boolean;
  onAiPageOpenWithOutline: () => void;
  onOpenSettings: (tab?: "general" | "appearance" | "ai" | "data") => void;
}

export function useSidebarEffects({
  currentView,
  isAiPageOpen,
  onAiPageOpenWithOutline,
  onOpenSettings,
}: UseSidebarEffectsOptions) {
  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        if (isAiPageOpen) return;

        const target = e.target as HTMLElement;
        const isInEditor =
          target.isContentEditable ||
          target.closest(".bn-editor") ||
          target.closest("[data-ai-composer-editor]") ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA";

        // 直读 store 最新值：连续按 Mod+Backspace 时，React 重渲染（更新
        // activePageId prop）滞后于 zustand 同步 set，闭包里的 activePageId
        // 仍是上一个已删除的 id，会导致第二次删除空转。
        const currentActivePageId = usePages.getState().activePageId;
        if (currentActivePageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          void deletePageWithUndo(currentActivePageId);
        }
      }
    },
    [currentView, isAiPageOpen],
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
