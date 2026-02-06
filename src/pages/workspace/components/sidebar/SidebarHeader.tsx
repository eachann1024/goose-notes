import { NotebookSwitcher } from "./NotebookSwitcher";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "sonner";

interface SidebarHeaderProps {
  onCreatePage: () => void;
  onSearch: () => void;
}

export function SidebarHeader({ onCreatePage, onSearch }: SidebarHeaderProps) {
  const { activeNotebookId, notebooks } = useNotebooks();
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";

  return (
    <>
      <div className="px-3 h-12 flex items-center shrink-0">
        <div className="flex items-center gap-1 w-full">
          <div className="flex-1 min-w-0">
            <NotebookSwitcher />
          </div>
          <Button
            onClick={async () => {
              if (
                typeof (window as any).utools?.showOpenDialog === "function"
              ) {
                const result = await (window as any).utools.showOpenDialog({
                  title: "选择 Markdown 文件夹",
                  properties: ["openDirectory"],
                });
                if (result && result.length > 0) {
                  const folderName =
                    result[0].split(/[\\/]/).pop() || "Unknown";
                  const notebookId = useNotebooks
                    .getState()
                    .createLocalFolderNotebook(
                      folderName,
                      result[0],
                    );
                  usePages
                    .getState()
                    .loadLocalFolderPages(notebookId, result[0], {
                      showWelcome: true,
                    });
                }
              } else {
                try {
                  const path = await window.gooseFs?.selectDirectory?.();
                  if (path) {
                    const folderName = path.split(/[\\/]/).pop() || "Unknown";
                    const notebookId = useNotebooks
                      .getState()
                      .createLocalFolderNotebook(
                        folderName,
                        path,
                      );
                    await usePages
                      .getState()
                      .loadLocalFolderPages(notebookId, path, {
                        showWelcome: true,
                      });
                  }
                } catch (e) {
                  console.error(e);
                  toast.error("打开文件夹失败: " + String(e));
                }
              }
            }}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground dark:hover:text-foreground/85"
            title="打开文件夹"
          >
            <LucideIcons.FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            onClick={onCreatePage}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground dark:hover:text-foreground/85"
            title={isLocalFolder ? "新建文件" : "新建页面"}
          >
            <LucideIcons.SquarePen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2 pt-0">
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-muted-foreground dark:text-muted-foreground/70 h-8 px-2 bg-gradient-to-r from-muted/40 to-muted/30 border-transparent shadow-none",
            "hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 hover:text-foreground dark:hover:text-foreground/85 transition-all duration-200",
          )}
          onClick={onSearch}
        >
          <LucideIcons.Search className="mr-2 h-4 w-4 opacity-50" />
          <span className="text-sm">搜索</span>
          <span className="ml-auto text-xs text-muted-foreground/50 dark:text-muted-foreground/40">⌘K</span>
        </Button>
      </div>
    </>
  );
}
