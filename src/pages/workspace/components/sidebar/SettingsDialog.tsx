import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsSidebar } from "./SettingsSidebar";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  exportNotebooks,
  importNotebooksFromZip,
  type ExportOptions,
} from "@/lib/export";
import { uToolsStorage as dataStorage } from "@/lib/storage";
import {
  Download,

  FileText,
  Globe,
  Check,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "appearance" | "data";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const descriptionId = useId();
  const resetDescriptionId = useId();
  const {
    theme,
    setTheme,
    codeStyle,
    setCodeStyle,
    searchProviders,
    toggleSearchProvider,
    utools,
    setOpenSearchInUtools,
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
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");

  const notebookList = Object.values(notebooks);
  const { createNotebook } = useNotebooks();
  const { createPage, updatePage } = usePages();
  const resetPhrase = "我已知晓风险";
  const canReset = resetInput.trim() === resetPhrase;

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
        { format, notebookIds: selectedIds },
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

        toast.success("导入成功", {
          description: "已恢复记事本和页面结构",
        });
      } catch (err) {
        console.error("Import failed", err);
        toast.error("导入失败", {
          description: "请确保文件是有效的导出 ZIP 包",
        });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  useEffect(() => {
    if (!resetDialogOpen) {
      setResetInput("");
    }
  }, [resetDialogOpen]);

  const handleReset = () => {
    if (!canReset) return;
    dataStorage.removeItem("goose-note-storage");
    dataStorage.removeItem("goose-note-notebooks");
    const defaultNotebook = {
      id: DEFAULT_NOTEBOOK,
      name: "Note",
      icon: "📓",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    useNotebooks.setState({
      notebooks: { [DEFAULT_NOTEBOOK]: defaultNotebook },
      activeNotebookId: DEFAULT_NOTEBOOK,
      lastActivePageByNotebook: {},
    });
    usePages.setState({
      pages: {},
      activePageId: null,
      onboardingCompleted: false,
      onboardingExpandPageId: null,
    });
    setResetDialogOpen(false);
    onOpenChange(false);
    setTimeout(() => {
      window.location.reload();
    }, 60);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={descriptionId}
          className="sm:max-w-[700px] h-[500px] flex flex-col p-0 gap-0 overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>设置</DialogTitle>
            <DialogDescription id={descriptionId}>
              配置应用的设置选项
            </DialogDescription>
          </DialogHeader>
          <div className="flex bg-muted/30 h-full">
            <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === "general" && (
                <SettingsGeneral
                  searchProviders={searchProviders}
                  toggleSearchProvider={toggleSearchProvider}
                  openSearchInUtools={utools.openSearchInUtools}
                  setOpenSearchInUtools={setOpenSearchInUtools}
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
                                <span className="truncate">
                                  {notebook.name}
                                </span>
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
                      <div className="grid grid-cols-2 gap-2">
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

                      </div>
                    </div>


                    <Button
                      className="w-full"
                      onClick={handleExport}
                      disabled={selectedIds.length === 0 || exporting}
                    >
                      {exporting ? "导出中..." : "开始导出"}
                      {!exporting && <Download className="ml-2 w-4 h-4" />}
                    </Button>

                    <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-destructive">
                          重置所有数据
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          删除所有记事本和页面，保留设置。此操作不可撤销。
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8"
                        onClick={() => setResetDialogOpen(true)}
                      >
                        重置所有数据
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent
          aria-describedby={resetDescriptionId}
          className="sm:max-w-[420px]"
        >
          <DialogHeader>
            <DialogTitle>确认重置所有数据？</DialogTitle>
            <DialogDescription
              id={resetDescriptionId}
              className="text-destructive"
            >
              这将永久删除所有记事本和页面。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reset-all" className="text-muted-foreground">
              请输入
              <span className="font-bold text-foreground select-all">
                {resetPhrase}
              </span>
              以确认重置
            </Label>
            <Input
              id="reset-all"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder={resetPhrase}
              className="w-full h-11 mt-2"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={!canReset}
            >
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
