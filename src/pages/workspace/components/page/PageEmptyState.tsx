import { Search, Plus, Sparkles } from "lucide-react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getPageTitle } from "@/lib/page-title";
import { DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";

const tips = [
  "使用 / 命令快速插入内容块",
  "拖拽调整页面顺序",
  "打开本地文件夹可批量管理 Markdown 笔记",
];

function getRandomTip() {
  return tips[Math.floor(Math.random() * tips.length)];
}

const isEmptyContent = (
  content:
    | {
        type?: string;
        content?: Array<{
          type?: string;
          content?: unknown[];
        }>;
      }
    | null
    | undefined,
) => {
  if (!content || content.type !== "doc") return true;
  if (!content.content || content.content.length === 0) return true;
  if (content.content.length === 1) {
    const first = content.content[0];
    if (
      first.type === "paragraph" &&
      (!first.content || first.content.length === 0)
    ) {
      return true;
    }
  }
  return false;
};

export function PageEmptyState() {
  const {
    createPage,
    createLocalPage,
    pages,
    setActivePage,
    loadLocalFolderPages,
  } = usePages();
  const {
    activeNotebookId,
    notebooks,
    createNotebook,
    setActiveNotebook,
    createLocalFolderNotebook,
  } = useNotebooks();
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";

  const onCreatePage = useCallback(() => {
    // 如果没有活跃笔记本，创建一个默认笔记本
    let notebookId = activeNotebookId;
    if (!notebookId) {
      const notebookIds = Object.keys(notebooks);
      if (notebookIds.length === 0) {
        notebookId = createNotebook("我的笔记");
        toast.success("已自动创建笔记本");
      } else {
        notebookId = notebookIds[0];
        setActiveNotebook(notebookId);
      }
    }

    const notebook = notebookId ? notebooks[notebookId] : undefined;
    const isLocalFolder = notebook?.source === "local-folder";

    if (isLocalFolder) {
      createLocalPage(undefined, notebookId || undefined);
      return;
    }

    const matchWorkspaceId = notebookId || DEFAULT_NOTEBOOK;
    const existingBlankPage = Object.values(pages).find((p) => {
      const matchWorkspace = p.workspaceId === matchWorkspaceId;
      const notTrashed = !p.trashedAt;
      const title = getPageTitle(p);
      const isBlankTitle = !title || title === "无标题" || title.trim() === "";
      const isBlankContent = isEmptyContent(p.content);
      return matchWorkspace && notTrashed && isBlankTitle && isBlankContent;
    });

    if (existingBlankPage) {
      setActivePage(existingBlankPage.id);
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
      return;
    }

    const newPageId = createPage(undefined, matchWorkspaceId);
    setActivePage(newPageId);
  }, [
    activeNotebookId,
    notebooks,
    createNotebook,
    setActiveNotebook,
    createLocalPage,
    pages,
    setActivePage,
    createPage,
  ]);

  const onSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("goose-note:open-search"));
  }, []);

  const onOpenLocalFolder = useCallback(async () => {
    const utools = (
      window as {
        utools?: {
          showOpenDialog?: (options: {
            title: string;
            properties: string[];
          }) => Promise<string[]>;
        };
      }
    ).utools;
    if (typeof utools?.showOpenDialog === "function") {
      const result = await utools.showOpenDialog({
        title: "选择 Markdown 文件夹",
        properties: ["openDirectory"],
      });
      if (result && result.length > 0) {
        const folderPath = result[0];
        const folderName = folderPath.split(/[\\/]/).pop() || "Unknown";
        const notebookId = createLocalFolderNotebook(
          folderName,
          folderPath,
        );
        await loadLocalFolderPages(notebookId, folderPath, {
          showWelcome: true,
        });
      }
      return;
    }

    try {
      const path = await window.gooseFs?.selectDirectory?.();
      if (path) {
        const folderName = path.split(/[\\/]/).pop() || "Unknown";
        const notebookId = createLocalFolderNotebook(folderName, path);
        await loadLocalFolderPages(notebookId, path, { showWelcome: true });
      }
    } catch (e) {
      console.error(e);
      toast.error("打开文件夹失败: " + String(e));
    }
  }, [createLocalFolderNotebook, loadLocalFolderPages]);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Option+P: 新建页面
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === "p") {
        e.preventDefault();
        onCreatePage();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCreatePage]);

  const actions = [
    {
      icon: Plus,
      title: isLocalFolder ? "新建文件" : "新建页面",
      description: isLocalFolder
        ? "在当前文件夹创建 Markdown 文件"
        : "创建一个空白页面开始记录",
      onClick: onCreatePage,
      color: "from-primary to-primary/60",
    },
    {
      icon: Sparkles,
      title: "打开本地文件夹",
      description: "批量管理 Markdown 笔记",
      onClick: onOpenLocalFolder,
      color: "from-emerald-500 to-emerald-500/60",
    },
    {
      icon: Search,
      title: "搜索内容",
      description: "快速查找已记录的内容",
      onClick: onSearch,
      color: "from-blue-500 to-blue-500/60",
    },
  ];

  return (
    <div className="h-full flex items-center justify-center p-8 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      {/* 内容区 */}
      <div className="relative w-full max-w-4xl">
        {/* Logo 和标题 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-6 shadow-xl shadow-primary/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            准备好记录想法了吗？
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {isLocalFolder
              ? "点击左侧侧边栏新建文件，或选择现有文件开始记录"
              : "点击左侧侧边栏新建页面，或选择现有页面开始记录"}
          </p>
        </div>

        {/* 操作卡片网格 */}
        <div className="grid md:grid-cols-3 gap-5 mb-12 max-w-4xl mx-auto">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                }}
                type="button"
                className="group relative p-6 rounded-2xl border-2 bg-gradient-to-br from-card/70 to-card/50 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:from-card/80 hover:to-card/60 cursor-pointer"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 text-left">
                  {action.title}
                </h3>
                <p className="text-sm text-muted-foreground text-left">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground/80 flex items-center justify-center gap-2">
            <span className="text-lg">💡</span>
            <span>{getRandomTip()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
