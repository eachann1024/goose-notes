import * as GooseIcons from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { closeNotebookAiIfFullscreen } from "../../notebook-ai/useNotebookAiPanel";
import { triggerLabel, formatTime } from "./historyViewPresentation";
import { useHistoryViewLogic } from "./useHistoryViewLogic";

export /**
 * 页面历史模块（历史模式下占据整块侧栏主体，替换笔记本头 + 页面树/大纲）。
 * 不自带宽度/背景/边框——靠 Sidebar 父容器提供（Sidebar 已是 shell-bg）。
 * 退出按钮在主区 HistoryToolbar 上，这里不重复放。
 */
function HistoryVersionList() {
  const {
    groups,
    isEmpty,
    indexError,
    selectedVersionId,
    pendingMilestoneVersionId,
    select,
    handleToggleMilestone,
  } = useHistoryViewLogic();

  return (
    <div className="flex-1 min-h-0 flex flex-col" aria-label="页面历史">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <GooseIcons.History className="h-3.5 w-3.5 text-[var(--goose-interactive-selected-fg)]" />
          <span className="text-[12px] font-medium text-foreground">
            页面历史
          </span>
        </div>
        {!isEmpty && (
          <p className="mt-1 truncate whitespace-nowrap text-[11px] leading-none text-muted-foreground">
            选择时间点预览后还原
          </p>
        )}
      </div>
      {isEmpty ? (
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          {indexError ?? "暂无历史版本"}
        </p>
      ) : (
        <ScrollArea className="flex-1">
          <div className="py-1 pb-4">
            {groups.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                <div className="px-2">
                  {group.items.map((v, index) => {
                    const isSelected = selectedVersionId === v.versionId;
                    const isMilestonePending =
                      pendingMilestoneVersionId === v.versionId;
                    const isFirst = index === 0;
                    const isLast = index === group.items.length - 1;
                    const delta = v.charDelta;
                    const deltaText =
                      delta === 0 ? null : delta > 0 ? `+${delta}` : `${delta}`;
                    const detailTitle = [
                      new Date(v.createdAt).toLocaleString("zh-CN"),
                      triggerLabel(v.trigger),
                      `${v.charCount} 字`,
                      deltaText ? `变化 ${deltaText}` : null,
                      v.label || null,
                      v.isMilestone ? "里程碑" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={v.versionId}
                        data-selected={isSelected ? "true" : "false"}
                        className={cn(
                          "history-version-item group relative flex items-center rounded-[10px] transition-colors duration-150",
                          isSelected
                            ? "bg-[var(--goose-interactive-selected)]"
                            : "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                        )}
                      >
                        {/* 绝对定位轨道：覆盖整行高度（含 padding），相邻项首尾相接不断线 */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute bottom-0 left-1.5 top-0 z-[1] flex w-4 items-center justify-center"
                        >
                          {!isFirst ? (
                            <span className="absolute bottom-1/2 left-1/2 top-0 w-px -translate-x-1/2 bg-border/70" />
                          ) : null}
                          {!isLast ? (
                            <span className="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-border/70" />
                          ) : null}
                          <span
                            className={cn(
                              "relative z-[1] h-2 w-2 rounded-marker border",
                              isSelected
                                ? "border-[var(--goose-interactive-selected-fg)] bg-[var(--goose-interactive-selected-fg)]"
                                : "border-border bg-[hsl(var(--goose-shell-bg))]",
                            )}
                          />
                        </span>
                        <button
                          type="button"
                          title={detailTitle}
                          aria-current={isSelected ? "true" : undefined}
                          data-selected={isSelected ? "true" : "false"}
                          aria-label={`查看 ${group.label} ${formatTime(v.createdAt)} 的历史版本`}
                          onClick={() => {
                            closeNotebookAiIfFullscreen();
                            select(v.versionId);
                          }}
                          className="history-version-row flex min-h-8 w-full min-w-0 cursor-pointer items-start py-1.5 pl-8 pr-8 text-left transition-colors duration-150 "
                        >
                          <span
                            className={cn(
                              "min-w-0 text-xs leading-snug",
                              isSelected
                                ? "font-medium text-[var(--goose-interactive-selected-fg)]"
                                : "text-foreground group-hover:text-[var(--goose-interactive-hover-fg)]",
                            )}
                          >
                            <span className="tabular-nums">
                              {formatTime(v.createdAt)}
                            </span>
                            {v.label ? (
                              <span
                                className={cn(
                                  "ml-1.5 font-normal",
                                  isSelected
                                    ? "text-[var(--goose-interactive-selected-fg)]"
                                    : "text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)]",
                                )}
                              >
                                {v.label}
                              </span>
                            ) : null}
                            {deltaText ? (
                              <span
                                className={cn(
                                  "ml-1.5 text-[10px] tabular-nums",
                                  isSelected
                                    ? "text-[var(--goose-interactive-selected-fg)]"
                                    : "text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)]",
                                )}
                              >
                                {deltaText}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          data-marked={v.isMilestone ? "true" : "false"}
                          aria-busy={isMilestonePending || undefined}
                          aria-pressed={v.isMilestone}
                          aria-label={
                            isMilestonePending
                              ? v.isMilestone
                                ? "正在取消标记此版本"
                                : "正在标记此版本"
                              : v.isMilestone
                                ? "取消标记此版本"
                                : "标记此版本"
                          }
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            if (event.button !== 0) return;
                            event.preventDefault();
                            handleToggleMilestone(v.versionId, !v.isMilestone);
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (event.detail !== 0) return;
                            handleToggleMilestone(v.versionId, !v.isMilestone);
                          }}
                          className={cn(
                            "history-star-control group/star absolute right-0.5 top-1/2 z-[2] flex h-7 w-7 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-[8px] transition-[background-color,color] duration-150 hover:bg-[var(--goose-interactive-hover)] dark:hover:bg-[var(--goose-interactive-hover)] active:bg-[var(--goose-interactive-selected)]",
                            "",
                          )}
                        >
                          <GooseIcons.Star
                            fill={v.isMilestone ? "currentColor" : undefined}
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-colors group-hover/star:text-foreground",
                              v.isMilestone &&
                                "fill-[var(--goose-interactive-selected-fg)] text-[var(--goose-interactive-selected-fg)] group-hover/star:text-[var(--goose-interactive-selected-fg)]",
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
