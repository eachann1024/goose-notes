import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsSidebar } from "./SettingsSidebar";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  exportNotebooks,
  importNotebooksFromZip,
  type ExportOptions,
} from "@/lib/export";
import {
  Download,
  FileJson,
  FileText,
  Globe,
  Check,
  Upload,
} from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "appearance" | "data";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const descriptionId = useId();
  const {
    theme,
    setTheme,
    codeStyle,
    setCodeStyle,
    searchProviders,
    toggleSearchProvider,
    customFonts,
    setCustomLabel,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
  } = useSettings();
  const { notebooks } = useNotebooks();
  const { pages } = usePages();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // 数据管理状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportOptions["format"]>("md");
  const [includeTrash, setIncludeTrash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const notebookList = Object.values(notebooks);
  const { createNotebook } = useNotebooks();
  const { createPage, updatePage } = usePages();

  const toggleNotebook = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === notebookList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notebookList.map((n) => n.id));
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      await exportNotebooks(
        { format, includeTrash, notebookIds: selectedIds },
        notebooks,
        Object.values(pages),
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.mdzip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        let firstWorkspaceId: string | null = null;
        let firstPageId: string | null = null;

        await importNotebooksFromZip(
          file,
          (name) => {
            const id = createNotebook(name);
            if (!firstWorkspaceId) firstWorkspaceId = id;
            return id;
          },
          (data, workspaceId, parentId) => {
            const id = createPage(parentId, workspaceId);
            updatePage(id, data);
            if (!firstPageId) firstPageId = id;
            return id;
          },
        );

        const { setActiveNotebook } = useNotebooks.getState();
        const { setActivePage } = usePages.getState();

        if (firstWorkspaceId) setActiveNotebook(firstWorkspaceId);
        if (firstPageId) setActivePage(firstPageId);

        alert("导入成功！已恢复记事本和页面结构。");
      } catch (err) {
        console.error("Import failed", err);
        alert("导入失败，请确保文件是有效的导出 ZIP 包。");
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={descriptionId}
        className="sm:max-w-[700px] h-[500px] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription id={descriptionId} className="sr-only">
          配置应用的设置选项
        </DialogDescription>
        <div className="flex bg-muted/30 h-full">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "general" && (
              <SettingsGeneral
                searchProviders={searchProviders}
                toggleSearchProvider={toggleSearchProvider}
              />
            )}
            {activeTab === "appearance" && (
              <SettingsAppearance
                theme={theme}
                setTheme={setTheme}
                codeStyle={codeStyle}
                setCodeStyle={setCodeStyle}
                customFonts={customFonts}
                setCustomLabel={setCustomLabel}
                setCustomFont={setCustomFont}
                uiFontSize={uiFontSize}
                setUIFontSize={setUIFontSize}
              />
            )}
            {activeTab === "data" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">数据管理</h3>
                    <p className="text-xs text-muted-foreground">
                      管理记事本的导入和导出。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImport}
                    disabled={importing}
                    className="h-8"
                  >
                    {importing ? "导入中..." : "导入 ZIP"}
                    {!importing && <Upload className="ml-2 w-3.5 h-3.5" />}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">
                        选择记事本 ({selectedIds.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAll}
                        className="h-8 px-2 text-xs"
                      >
                        {selectedIds.length === notebookList.length
                          ? "取消全选"
                          : "全选"}
                      </Button>
                    </div>
                    <ScrollArea className="h-[180px] border rounded-md p-2 bg-background/50">
                      <div className="space-y-1">
                        {notebookList.map((notebook) => (
                          <div
                            key={notebook.id}
                            onClick={() => toggleNotebook(notebook.id)}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer transition-colors text-sm",
                              selectedIds.includes(notebook.id)
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted",
                            )}
                          >
                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                              <span className="shrink-0">
                                {notebook.icon || "📓"}
                              </span>
                              <span className="truncate">{notebook.name}</span>
                            </div>
                            {selectedIds.includes(notebook.id) && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      导出格式
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={format === "md" ? "default" : "outline"}
                        className="flex flex-col gap-1 h-auto py-2"
                        onClick={() => setFormat("md")}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-xs">Markdown</span>
                      </Button>
                      <Button
                        variant={format === "html" ? "default" : "outline"}
                        className="flex flex-col gap-1 h-auto py-2"
                        onClick={() => setFormat("html")}
                      >
                        <Globe className="w-4 h-4" />
                        <span className="text-xs">HTML</span>
                      </Button>
                      <Button
                        variant={format === "json" ? "default" : "outline"}
                        className="flex flex-col gap-1 h-auto py-2"
                        onClick={() => setFormat("json")}
                      >
                        <FileJson className="w-4 h-4" />
                        <span className="text-xs">JSON</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border rounded-md p-3 bg-background/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        包含回收站页面
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        勾选后将同时导出已删除但未清空的页面
                      </p>
                    </div>
                    <Switch
                      checked={includeTrash}
                      onCheckedChange={setIncludeTrash}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleExport}
                    disabled={selectedIds.length === 0 || exporting}
                  >
                    {exporting ? "导出中..." : "开始导出"}
                    {!exporting && <Download className="ml-2 w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
