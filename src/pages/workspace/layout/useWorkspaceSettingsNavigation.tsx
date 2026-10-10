import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SettingsTab } from "../components/sidebar/settings/types";
import { useEffectiveSidebarCollapsed } from "@/hooks/useWorkspaceViewportCollapse";
import { closeAllOverlays } from "@/lib/closeAllOverlays";
import type { useWorkspaceLayoutState } from "./useWorkspaceLayoutState";

export function useWorkspaceSettingsNavigation(
  input: ReturnType<typeof useWorkspaceLayoutState>,
) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [settingsSidebarExpanded, setSettingsSidebarExpanded] = useState(true);

  const workspaceSidebarCollapsed = useEffectiveSidebarCollapsed();

  const effectiveSidebarCollapsed = settingsOpen
    ? !settingsSidebarExpanded
    : workspaceSidebarCollapsed;

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");

  const [settingsHost, setSettingsHost] = useState<HTMLElement | null>(null);

  const settingsOriginFocusRef = useRef<HTMLElement | null>(null);

  const focusAiAfterSettingsCloseRef = useRef(false);

  const previousSettingsOpenRef = useRef(settingsOpen);

  const editorHostRef = useRef<HTMLDivElement>(null);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.dispatchEvent(new CustomEvent("goose-note:close-settings"));
  }, []);

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    if (open) {
      if (!document.body.hasAttribute("data-goose-settings-open")) {
        settingsOriginFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      // Mark the active surface before synthetic Escape dismisses floating layers.
      document.body.setAttribute("data-goose-settings-open", "");
      closeAllOverlays();
      setSettingsSidebarExpanded(true);
    }
    setSettingsOpen(open);
  }, []);

  useEffect(() => {
    const closeOnAiOpen = () => {
      if (document.body.hasAttribute("data-goose-settings-open")) {
        focusAiAfterSettingsCloseRef.current = true;
      }
      closeSettings();
    };
    window.addEventListener("goose-note:open-ai-panel", closeOnAiOpen);
    window.addEventListener("goose-note:toggle-ai-panel", closeOnAiOpen);
    return () => {
      window.removeEventListener("goose-note:open-ai-panel", closeOnAiOpen);
      window.removeEventListener("goose-note:toggle-ai-panel", closeOnAiOpen);
    };
  }, [closeSettings]);

  useEffect(() => {
    const toggle = () => setSettingsSidebarExpanded((expanded) => !expanded);
    window.addEventListener("goose-note:toggle-settings-sidebar", toggle);
    return () =>
      window.removeEventListener("goose-note:toggle-settings-sidebar", toggle);
  }, []);

  useLayoutEffect(() => {
    const previousOpen = previousSettingsOpenRef.current;
    previousSettingsOpenRef.current = settingsOpen;
    const editorHost = editorHostRef.current;
    if (!editorHost) return;
    document.body.toggleAttribute("data-goose-settings-open", settingsOpen);
    editorHost.inert = settingsOpen;
    if (settingsOpen) editorHost.setAttribute("aria-hidden", "true");
    else editorHost.removeAttribute("aria-hidden");
    const focusAi = focusAiAfterSettingsCloseRef.current;
    focusAiAfterSettingsCloseRef.current = false;
    if (!previousOpen || settingsOpen) return;
    const restore = window.requestAnimationFrame(() => {
      // Settings close normally returns focus to the note. Opening AI from
      // settings must wait until the settings attribute and editor inert flag
      // are cleared, otherwise the composer ignores the focus request and the
      // note steals it back.
      if (focusAi) {
        window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
        return;
      }
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        !active.closest(".settings-shell, .settings-sidebar-navigation")
      )
        return;
      const origin = settingsOriginFocusRef.current;
      const target =
        origin?.isConnected && !origin.closest("[inert]")
          ? origin
          : document.querySelector<HTMLElement>(
              ".workspace-main-sheet [data-page-title-field], .workspace-main-sheet .bn-editor",
            );
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(restore);
  }, [settingsOpen]);

  useEffect(
    () => () => document.body.removeAttribute("data-goose-settings-open"),
    [],
  );
  return {
    ...input,
    settingsOpen,
    setSettingsOpen,
    settingsSidebarExpanded,
    setSettingsSidebarExpanded,
    workspaceSidebarCollapsed,
    effectiveSidebarCollapsed,
    settingsTab,
    setSettingsTab,
    settingsHost,
    setSettingsHost,
    settingsOriginFocusRef,
    focusAiAfterSettingsCloseRef,
    previousSettingsOpenRef,
    editorHostRef,
    closeSettings,
    handleSettingsOpenChange,
  };
}
