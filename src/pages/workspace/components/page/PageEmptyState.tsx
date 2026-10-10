import { cn } from "@/lib/utils";
import { isElectronHost } from "@/lib/local-vault";

import { usePageEmptyState } from "./empty-state/usePageEmptyState";

function AiCrystalFx() {
  return (
    <span className="page-empty-ai-fx" aria-hidden="true">
      <span className="page-empty-ai-orb page-empty-ai-orb--a" />
      <span className="page-empty-ai-orb page-empty-ai-orb--b" />
      <span className="page-empty-ai-orb page-empty-ai-orb--c" />
      <span className="page-empty-ai-sheen" />
      <span className="page-empty-ai-spark page-empty-ai-spark--1" />
      <span className="page-empty-ai-spark page-empty-ai-spark--2" />
      <span className="page-empty-ai-spark page-empty-ai-spark--3" />
    </span>
  );
}

export function PageEmptyState() {
  const { paused, isLocalFolder, aiEnabled, aiTilt, actions } = usePageEmptyState();

  return (
    <div
      className="workspace-page-empty h-full overflow-y-auto px-3 py-4 sm:px-6 sm:py-8 md:p-8 relative bg-[hsl(var(--goose-editor-bg))]"
      data-paused={paused ? "true" : "false"}
    >
      <div className="min-h-full flex items-start justify-center pt-2 sm:pt-4 md:pt-6">
        {/* 内容区 */}
        <div className="relative w-full max-w-5xl">
          {/* 标题 */}
          <div className="text-center mb-6 sm:mb-8 md:mb-12 pt-2 sm:pt-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3 md:mb-4">
              准备好记录想法了吗？
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {isElectronHost && !isLocalFolder
                ? "打开或关联本地文件夹，即可开始管理与书写笔记"
                : isLocalFolder
                  ? "在左侧目录点击 ＋ 新建笔记，或选择已有笔记开始书写"
                  : "在左侧目录点击 ＋ 新建笔记，或选择已有笔记开始书写"}
            </p>
          </div>

          {/* 操作卡片网格：AI 关 3 卡 / AI 开 4 卡（第 3=AI，第 4=搜索） */}
          <div
            className={cn(
              "grid grid-cols-1 min-[520px]:grid-cols-2 gap-3 sm:gap-4 md:gap-5 mx-auto",
              aiEnabled
                ? "max-w-5xl xl:grid-cols-4"
                : "max-w-4xl xl:grid-cols-3",
            )}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              const isAi = action.variant === "ai";
              return (
                <button
                  key={action.key}
                  onClick={() => {
                    void action.onClick();
                  }}
                  type="button"
                  onPointerMove={isAi ? aiTilt.onPointerMove : undefined}
                  onPointerLeave={isAi ? aiTilt.onPointerLeave : undefined}
                  className={cn(
                    "group relative cursor-pointer rounded-[12px] md:rounded-[14px] border border-transparent bg-[hsl(var(--goose-editor-bg))] p-4 sm:p-5 md:p-6 text-left shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--goose-interactive-hover)] hover:border-[hsl(var(--border))] hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--goose-selected-bg))] dark:shadow-[0_10px_28px_rgba(2,6,23,0.35)] dark:hover:bg-[var(--goose-interactive-hover)] dark:hover:border-[var(--goose-interactive-hover-border)] dark:hover:shadow-[0_16px_34px_rgba(2,6,23,0.55)]",
                    isAi && "page-empty-ai-card",
                  )}
                  style={isAi ? aiTilt.tiltStyle : undefined}
                >
                  <div
                    className={cn(
                      "w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-[9px] md:rounded-[10px] flex items-center justify-center mb-3 sm:mb-4 transition-[background-color,box-shadow,transform] duration-200 ease-out",
                      isAi
                        ? "page-empty-ai-chip"
                        : "bg-[hsl(var(--goose-selected-bg))] group-hover:scale-105 group-hover:bg-[var(--goose-interactive-selected)] group-hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:bg-[var(--goose-interactive-selected)] dark:shadow-[0_8px_18px_rgba(37,99,235,0.18)] dark:group-hover:bg-[var(--goose-interactive-selected)] dark:group-hover:shadow-[0_10px_22px_rgba(37,99,235,0.28)]",
                    )}
                  >
                    {isAi ? <AiCrystalFx /> : null}
                    <Icon
                      className={cn(
                        "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-muted-foreground transition-colors group-hover:text-[var(--goose-interactive-hover-fg)] dark:text-[var(--goose-interactive-selected-fg)]",
                        isAi && "page-empty-ai-icon",
                      )}
                    />
                  </div>
                  <h3
                    className={cn(
                      "text-base sm:text-lg font-semibold text-foreground mb-1.5 sm:mb-2 text-left transition-colors group-hover:text-[var(--goose-interactive-hover-fg)] dark:text-foreground",
                    )}
                  >
                    {action.title}
                  </h3>
                  <p className="hidden min-[420px]:block text-xs sm:text-sm text-muted-foreground text-left leading-relaxed transition-colors group-hover:text-[var(--goose-interactive-hover-fg)] dark:text-muted-foreground">
                    {action.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
