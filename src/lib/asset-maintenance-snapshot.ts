import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { usePages } from "@/stores/usePages";
import type { AssetWorkspaceSnapshot } from "./asset-maintenance-contract";

let installed = false;
/** 只读当前 store + 所有已挂载编辑器，不强制保存或修改用户草稿。 */
export function installAssetMaintenanceSnapshotResponder() {
  const bridge = window.gooseDesktop?.assetMaintenance;
  if (installed || !bridge) return;
  installed = true;
  bridge.onSnapshotRequest((requestId) => {
    try {
      const detail = { pages: [] as AssetWorkspaceSnapshot["pages"], failed: false };
      window.dispatchEvent(new CustomEvent("goose-note:asset-references", { detail }));
      if (detail.failed) throw new Error("无法读取编辑器");
      const notebooks = Object.values(useNotebooks.getState().notebooks)
        .filter((notebook) => notebook.source === "local-folder" && notebook.localPath)
        .map((notebook) => ({ id: notebook.id, name: notebook.name, localPath: notebook.localPath! }));
      const pages = Object.values(usePages.getState().pages)
        .filter((page) => page.localFilePath && !page.isFolder)
        .map((page) => ({ localFilePath: page.localFilePath, content: page.content, isFolder: page.isFolder }));
      const { theme, accentColor, customFonts, uiFontSize, editorFontSize, editorLineHeight, sidebarFontSize, uiFontFamily, sidebarFontFamily } = useSettings.getState();
      const appearance = { theme, accentColor, customFonts, uiFontSize, editorFontSize, editorLineHeight, sidebarFontSize, uiFontFamily, sidebarFontFamily };
      bridge.replySnapshot(requestId, { notebooks, pages: [...pages, ...detail.pages], appearance });
    } catch { bridge.replySnapshot(requestId, null); }
  });
}
