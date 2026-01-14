import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
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
  X,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "appearance" | "data";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
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
        let notebookCount = 0;
        let pageCount = 0;

        await importNotebooksFromZip(
          file,
          (name) => {
            notebookCount++;
            const id = createNotebook(name);
            if (!firstWorkspaceId) firstWorkspaceId = id;
            return id;
          },
          (data, workspaceId, parentId) => {
            pageCount++;
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
          description: `已恢复 ${notebookCount} 个记事本，共 ${pageCount} 个页面`,
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
    usePages.getState().createOnboardingPages();
    setResetDialogOpen(false);
    onOpenChange(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-gradient-to-r from-muted/40 to-muted/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">设置</h1>
            <p className="text-sm text-muted-foreground">
              配置应用偏好与数据管理
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 rounded-full hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40 transition-all duration-200"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 */}
        <div className="w-60 border-r bg-gradient-to-b from-muted/40 to-muted/20 p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("general")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === "general"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 text-muted-foreground",
              )}
            >
              <LucideIcons.Settings className="w-5 h-5" />
              <span className="font-medium">通用设置</span>
            </button>
            <button
              onClick={() => setActiveTab("appearance")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === "appearance"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 text-muted-foreground",
              )}
            >
              <LucideIcons.Laptop className="w-5 h-5" />
              <span className="font-medium">外观主题</span>
            </button>
            <button
              onClick={() => setActiveTab("data")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === "data"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 text-muted-foreground",
              )}
            >
              <LucideIcons.Database className="w-5 h-5" />
              <span className="font-medium">数据管理</span>
            </button>
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            {activeTab === "general" && (
              <div className="bg-gradient-to-br from-card/70 to-card/50 backdrop-blur-md border-2 rounded-2xl p-8 shadow-lg">
                <SettingsGeneral
                  searchProviders={searchProviders}
                  toggleSearchProvider={toggleSearchProvider}
                  openSearchInUtools={utools.openSearchInUtools}
                  setOpenSearchInUtools={setOpenSearchInUtools}
                />
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="bg-gradient-to-br from-card/70 to-card/50 backdrop-blur-md border-2 rounded-2xl p-8 shadow-lg">
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
              </div>
            )}

            {activeTab === "data" && (
              <div className="space-y-6">
                {/* 导入导出卡片 */}
                <div className="bg-gradient-to-br from-card/70 to-card/50 backdrop-blur-md border-2 rounded-2xl p-8 shadow-lg space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">数据管理</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        管理记事本的导入和导出
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleImport}
                      disabled={importing}
                      className="h-11"
                    >
                      {importing ? "导入中..." : "导入 ZIP"}
                      {!importing && <Upload className="ml-2 w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">
                        选择记事本 ({selectedIds.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAll}
                        className="h-8 px-3 text-xs hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40"
                      >
                        {selectedIds.length === notebookList.length
                          ? "取消全选"
                          : "全选"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-1">
                      {notebookList.map((notebook) => (
                        <button
                          key={notebook.id}
                          onClick={() => toggleNotebook(notebook.id)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left",
                            selectedIds.includes(notebook.id)
                              ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5"
                              : "border-border hover:border-primary/30 hover:bg-gradient-to-br hover:from-muted/40 hover:to-muted/20",
                          )}
                        >
                          <span className="text-xl shrink-0">
                            {notebook.icon || "📓"}
                          </span>
                          <span className="truncate text-sm">
                            {notebook.name}
                          </span>
                          {selectedIds.includes(notebook.id) && (
                            <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-muted-foreground">
                      导出格式
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={format === "md" ? "default" : "outline"}
                        className="h-20 flex flex-col gap-2 hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40"
                        onClick={() => setFormat("md")}
                      >
                        <FileText className="w-6 h-6" />
                        <div className="text-left">
                          <div className="font-medium">Markdown</div>
                          <div className="text-xs opacity-60">.md 文件</div>
                        </div>
                      </Button>
                      <Button
                        variant={format === "html" ? "default" : "outline"}
                        className="h-20 flex flex-col gap-2 hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40"
                        onClick={() => setFormat("html")}
                      >
                        <Globe className="w-6 h-6" />
                        <div className="text-left">
                          <div className="font-medium">HTML</div>
                          <div className="text-xs opacity-60">网页文件</div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 text-base"
                    onClick={handleExport}
                    disabled={selectedIds.length === 0 || exporting}
                  >
                    {exporting ? "导出中..." : "开始导出"}
                    {!exporting && <Download className="ml-2 w-5 h-5" />}
                  </Button>
                </div>

                {/* 危险操作卡片 */}
                <div className="bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-md border-2 border-destructive/30 rounded-2xl p-6 shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                        <LucideIcons.AlertTriangle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-destructive">
                          重置所有数据
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          删除所有记事本和页面，此操作不可撤销
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setResetDialogOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      重置所有数据
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 重置确认弹窗 */}
      {resetDialogOpen && (
        <div className="fixed inset-0 z-[60] bg-gradient-radial from-background/90 to-background/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-card/70 to-card/50 border-2 border-destructive/30 rounded-2xl p-6 shadow-xl max-w-md w-full backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                <LucideIcons.AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-destructive">
                  确认重置所有数据？
                </h3>
                <p className="text-sm text-destructive/80 mt-1">
                  这将永久删除所有记事本和页面
                </p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <Label
                htmlFor="reset-all"
                className="text-muted-foreground text-sm"
              >
                请输入
                <span className="font-bold text-foreground select-all">
                  {" "}
                  {resetPhrase}
                </span>{" "}
                以确认重置
              </Label>
              <Input
                id="reset-all"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder={resetPhrase}
                className="w-full h-11"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setResetDialogOpen(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!canReset}
                className="flex-1"
              >
                确认重置
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
