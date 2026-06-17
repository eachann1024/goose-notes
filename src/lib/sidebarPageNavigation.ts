import { useTabs } from "@/stores/useTabs";

let suppressNextSidebarSelect = false;
let suppressTimer: number | null = null;

export function openPageFromSidebar(
  pageId: string,
  mode: "preview" | "permanent",
  options?: { pin?: boolean },
) {
  const tabs = useTabs.getState();
  if (mode === "permanent") {
    suppressNextSidebarSelect = true;
    if (suppressTimer !== null) window.clearTimeout(suppressTimer);
    suppressTimer = window.setTimeout(() => {
      suppressNextSidebarSelect = false;
      suppressTimer = null;
    }, 400);
    tabs.openPermanentTab(pageId, options);
    return;
  }
  tabs.openPreviewTab(pageId);
}

export function shouldSuppressSidebarSelect(): boolean {
  if (!suppressNextSidebarSelect) return false;
  suppressNextSidebarSelect = false;
  if (suppressTimer !== null) {
    window.clearTimeout(suppressTimer);
    suppressTimer = null;
  }
  return true;
}