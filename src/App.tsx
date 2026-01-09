import { useEffect } from "react";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { useNotebooks } from "./stores/useNotebooks";
import { usePages } from "./stores/usePages";

function App() {
  useEffect(() => {
    const openFolder = (folderPath: string) => {
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(
          `本地文件夹 - ${folderPath.split("/").pop() || "Unknown"}`,
          folderPath,
        );
      usePages.getState().loadLocalFolderPages(notebookId, folderPath);
    };

    const handleOpenFolder = (event: any) => {
      const { path: folderPath } = event.detail || {};
      if (typeof folderPath === "string" && folderPath.length > 0) {
        openFolder(folderPath);
      }
    };

    window.addEventListener("goose-note:open-folder", handleOpenFolder);

    const pending = (window as any).__gooseNotePendingOpenFolder;
    if (typeof pending === "string" && pending.length > 0) {
      (window as any).__gooseNotePendingOpenFolder = null;
      openFolder(pending);
    }

    return () => {
      window.removeEventListener("goose-note:open-folder", handleOpenFolder);
    };
  }, []);

  return (
    <>
      <WorkspacePage />
      <Toaster />
    </>
  );
}

export default App;
