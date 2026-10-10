import { useEffect, useRef } from "react";
import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { normalizeAppShortcuts } from "@/stores/settings/slices/shortcutsSlice";
import { installAppHotkeyListeners } from "./appHotkeys/listeners";

export function useAppHotkeys() {
  const { appShortcuts } = useSettings();

  const { openTabs, activeTabId } = useTabs();

  // Dynamic values consumed inside the single keydown listener must be read
  // through refs, otherwise the once-registered listener would capture stale
  // values (breaks tab switching / close after the list changes).
  const appShortcutsRef = useRef(normalizeAppShortcuts(appShortcuts));

  const openTabsRef = useRef(openTabs);

  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    appShortcutsRef.current = normalizeAppShortcuts(appShortcuts);
  }, [appShortcuts]);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);
  useEffect(
    () =>
      installAppHotkeyListeners({
        appShortcutsRef,
        openTabsRef,
        activeTabIdRef,
      }),
    [],
  );
}
