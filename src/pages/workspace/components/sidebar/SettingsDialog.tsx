import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
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
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useState as useReactState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "appearance" | "data";

const SETTINGS_TABS: {
  id: SettingsTab;
  label: string;
  icon: typeof LucideIcons.Settings;
}[] = [
  { id: "general", label: "通用设置", icon: LucideIcons.Settings },
  { id: "appearance", label: "外观主题", icon: LucideIcons.Laptop },
  { id: "data", label: "数据管理", icon: LucideIcons.Database },
];

// 推荐应用数据
const RECOMMENDED_APPS = [
  {
    id: "goose-bookmark",
    name: "鹅的书签",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%B9%A6%E7%AD%BE/",
  },
  {
    id: "goose-billiard",
    name: "鹅的桌球",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E6%A1%8C%E7%90%83/",
  },
];

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
    setUToolsWindowHeight,
    privacy,
    setAutoOpenLastNote,
    customFonts,
    setCustomLabel,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
    customActions,
    addCustomAction,
    updateCustomAction,
    removeCustomAction,
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
  const [appsBannerClosed, setAppsBannerClosed] = useReactState(() => {
    return localStorage.getItem("goose-note-apps-banner-closed") === "true";
  });

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
    });
    setResetDialogOpen(false);
    onOpenChange(false);
  };

  const handleCloseAppsBanner = () => {
    setAppsBannerClosed(true);
    localStorage.setItem("goose-note-apps-banner-closed", "true");
  };

  const handleOpenAppUrl = (url: string) => {
    const w = window as unknown as { utools?: { shellOpenExternal: (url: string) => void } };
    if (typeof window !== "undefined" && w.utools) {
      w.utools.shellOpenExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-muted flex flex-col animate-in fade-in duration-200">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 bg-background border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">设置</h1>
            <p className="text-xs text-muted-foreground">
              配置应用偏好与数据管理
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* 主内容区 - 灰色背景，左右两块白色区域 */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* 左侧导航栏 - 白色卡片 */}
        <div className="w-56 bg-background rounded-xl flex flex-col shadow-sm">
          <nav className="flex-1 p-3 space-y-1">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 推荐应用菜单 */}
          {!appsBannerClosed && (
            <div className="p-3 border-t">
              <div className="bg-muted/50 rounded-lg p-3 relative">
                <button
                  onClick={handleCloseAppsBanner}
                  className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-muted-foreground/10 transition-colors"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
                <p className="text-xs font-medium text-muted-foreground mb-2 pr-4">
                  探索更多应用
                </p>
                <div className="space-y-1">
                  {RECOMMENDED_APPS.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleOpenAppUrl(app.url)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                    >
                      <span className="truncate flex-1">{app.name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧内容区 - 白色卡片 */}
        <div className="flex-1 bg-background rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-5xl">
              {activeTab === "general" && (
                <div className="space-y-4">
                  <SettingsGeneral
                    searchProviders={searchProviders}
                    toggleSearchProvider={toggleSearchProvider}
                    openSearchInUtools={utools.openSearchInUtools}
                    setOpenSearchInUtools={setOpenSearchInUtools}

                    windowHeight={utools.windowHeight ?? 600}
                    setWindowHeight={setUToolsWindowHeight}
                    autoOpenLastNote={privacy.autoOpenLastNote}
                    setAutoOpenLastNote={setAutoOpenLastNote}
                    customActions={customActions}
                    addCustomAction={addCustomAction}
                    updateCustomAction={updateCustomAction}
                    removeCustomAction={removeCustomAction}
                  />

                  {/* 新手指引 */}
                  <div className="bg-muted/50 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">新手指引</h3>
                          <p className="text-xs text-muted-foreground">
                            重新展示交互式引导教程
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div>
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
                <div className="space-y-4">
                  {/* 导入导出卡片 */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">数据管理</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          管理记事本的导入和导出
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImport}
                        disabled={importing}
                      >
                        {importing ? "导入中..." : "导入 ZIP"}
                        {!importing && <Upload className="ml-2 w-4 h-4" />}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">
                          选择记事本 ({selectedIds.length})
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAll}
                          className="h-7 px-2 text-xs"
                        >
                          {selectedIds.length === notebookList.length
                            ? "取消全选"
                            : "全选"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        {notebookList.map((notebook) => (
                          <button
                            key={notebook.id}
                            onClick={() => toggleNotebook(notebook.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-200 text-left",
                              selectedIds.includes(notebook.id)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/50",
                            )}
                          >
                            <span className="text-lg shrink-0">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        导出格式
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={format === "md" ? "default" : "outline"}
                          className="h-16 flex flex-col gap-1"
                          onClick={() => setFormat("md")}
                        >
                          <FileText className="w-5 h-5" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Markdown</div>
                            <div className="text-xs opacity-60">.md 文件</div>
                          </div>
                        </Button>
                        <Button
                          variant={format === "html" ? "default" : "outline"}
                          className="h-16 flex flex-col gap-1"
                          onClick={() => setFormat("html")}
                        >
                          <Globe className="w-5 h-5" />
                          <div className="text-left">
                            <div className="font-medium text-sm">HTML</div>
                            <div className="text-xs opacity-60">网页文件</div>
                          </div>
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
                  </div>

                  {/* 危险操作卡片 */}
                  <div className="bg-muted/50 rounded-xl p-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <LucideIcons.AlertTriangle className="w-4 h-4 text-destructive" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm text-destructive">
                            重置所有数据
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            删除所有记事本和页面，此操作不可撤销
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
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
        </div>
      </div>

      {/* 重置确认弹窗 */}
      {resetDialogOpen && (
        <div className="fixed inset-0 z-[60] bg-muted flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background rounded-xl p-6 shadow-xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <LucideIcons.AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-destructive">
                  确认重置所有数据？
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  这将永久删除所有记事本和页面
                </p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <Label
                htmlFor="reset-all"
                className="text-muted-foreground text-xs"
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
                className="w-full h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
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
    document.body
  );
}
