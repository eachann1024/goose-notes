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
    },
    {
      icon: Sparkles,
      title: "打开本地文件夹",
      description: "批量管理 Markdown 笔记",
      onClick: onOpenLocalFolder,
    },
    {
      icon: Search,
      title: "搜索内容",
      description: "快速查找已记录的内容",
      onClick: onSearch,
    },
  ];

  return (
    <div className="h-full flex items-center justify-center p-8 relative overflow-hidden bg-[hsl(var(--goose-editor-bg))]">
      {/* 内容区 */}
      <div className="relative w-full max-w-4xl">
        {/* Logo 和标题 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[14px] bg-[hsl(var(--goose-editor-bg))] mb-6 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
            <Sparkles className="w-10 h-10 text-muted-foreground/75" />
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
                  className="group relative cursor-pointer rounded-[14px] border-0 bg-[hsl(var(--goose-editor-bg))] p-6 text-left shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-colors duration-200 hover:bg-[hsl(var(--goose-selected-bg)/0.8)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                <div
                  className="w-14 h-14 rounded-[10px] bg-[hsl(var(--goose-selected-bg))] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                >
                  <Icon className="w-7 h-7 text-foreground/75" />
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

      </div>
    </div>
  );
}
