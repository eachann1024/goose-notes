import { useTabs } from "@/stores/useTabs";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";

const isElectronHost =
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

let suppressNextSidebarSelect = false;
let suppressTimer: number | null = null;

export function isLocalFolderDirectoryPage(pageId: string): boolean {
  const page = usePages.getState().getPage(pageId);
  if (!page?.isFolder) return false;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  return notebook?.source === "local-folder";
}

/** 桌面本地模式：文件夹只用于侧栏展开/收起，不作为可打开的页面。 */
export function isElectronLocalFolderDirectory(pageId: string): boolean {
  return isElectronHost && isLocalFolderDirectoryPage(pageId);
}

export function openPageFromSidebar(
  pageId: string,
  mode: "preview" | "permanent",
  options?: { pin?: boolean },
) {
  // Electron：文件夹不进主区。uTools 本地文件夹仍打开 FolderHomePage。
  if (isElectronLocalFolderDirectory(pageId)) return;

  // AI 全屏时主区域被会话盖住：侧栏点页面应退出 AI 并切到该标签
  // （与标签栏 onBeforeActivateTab 行为对齐）
  closeNotebookAiIfFullscreen();

  const tabs = useTabs.getState();
  const effectiveMode = useSettings.getState().singleTabMode ? "preview" : mode;
  if (effectiveMode === "permanent") {
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
