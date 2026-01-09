import { NotebookSwitcher } from "./NotebookSwitcher";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

interface SidebarHeaderProps {
  onCreatePage: () => void;
  onSearch: () => void;
}

export function SidebarHeader({ onCreatePage, onSearch }: SidebarHeaderProps) {
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
                  const notebookId = useNotebooks
                    .getState()
                    .createLocalFolderNotebook(
                      `本地 - ${result[0].split("/").pop() || "Unknown"}`,
                      result[0],
                    );
                  usePages
                    .getState()
                    .loadLocalFolderPages(notebookId, result[0]);
                }
              }
            }}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            title="打开文件夹"
          >
            <LucideIcons.FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            onClick={onCreatePage}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            title="新建页面"
          >
            <LucideIcons.SquarePen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2 pt-0">
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-muted-foreground h-8 px-2 bg-muted/40 border-transparent shadow-none",
            "hover:bg-muted/60 hover:text-foreground transition-colors",
          )}
          onClick={onSearch}
        >
          <LucideIcons.Search className="mr-2 h-4 w-4 opacity-50" />
          <span className="text-sm">搜索</span>
          <span className="ml-auto text-xs text-muted-foreground/50">⌘K</span>
        </Button>
      </div>
    </>
  );
}
