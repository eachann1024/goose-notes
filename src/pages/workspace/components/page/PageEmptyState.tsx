import { Search, Keyboard, Plus, Sparkles, ArrowRight } from "lucide-react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";

const tips = [
  "使用 / 命令快速插入内容块",
  "拖拽调整页面顺序",
  "Ctrl/Cmd + D 快速复制当前行",
  "Ctrl/Cmd + / 插入代码块",
];

function getRandomTip() {
  return tips[Math.floor(Math.random() * tips.length)];
}

export function PageEmptyState() {
  const onCreatePage = () => {
    const { createPage } = usePages();
    const { activeNotebookId } = useNotebooks.getState();
    if (!activeNotebookId) return;

    const newPage = createPage(undefined, activeNotebookId);
    usePages.setState({ activePageId: newPage });
  };

  const actions = [
    {
      icon: Plus,
      title: "新建页面",
      description: "创建一个空白页面开始记录",
      shortcut: "⌘ + ⌥ + P",
      onClick: onCreatePage,
      color: "from-primary to-primary/60",
    },
    {
      icon: Search,
      title: "搜索内容",
      description: "快速查找已记录的内容",
      shortcut: "⌘ + K",
      onClick: () => {
        // 触发命令面板
      },
      color: "from-blue-500 to-blue-500/60",
    },
    {
      icon: Keyboard,
      title: "快捷键",
      description: "查看所有可用快捷键",
      shortcut: "⌘ + /",
      onClick: () => {
        // 触发快捷键面板
      },
      color: "from-purple-500 to-purple-500/60",
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
            点击左侧侧边栏新建页面，或选择现有页面开始记录
          </p>
        </div>

        {/* 操作卡片网格 */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.onClick}
                className="group relative p-6 rounded-2xl border-2 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 text-left">
                  {action.title}
                </h3>
                <p className="text-sm text-muted-foreground text-left mb-4">
                  {action.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {action.shortcut}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>

        {/* 插画区域 */}
        {/* <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl blur-3xl" />
          <img
            src="https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/welcome-cover.png"
            alt="Welcome"
            className="relative w-full h-auto max-h-[40vh] object-contain opacity-90 mx-auto"
          />
        </div> */}

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
