import { type ReactNode } from "react";
import * as GooseIcons from "@/components/ui/icons";
import type { GooseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HistoryReadOnlyEditor } from "../HistoryReadOnlyEditor";
import { useHistoryViewLogic } from "./useHistoryViewLogic";

export function HistoryReaderState({
  icon: Icon,
  title,
  description,
  spinning = false,
  action,
}: {
  icon: GooseIcon;
  title: string;
  description?: string;
  spinning?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="h-full min-h-[280px] flex items-center justify-center px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--goose-interactive-hover)] text-muted-foreground">
          <Icon
            className={cn("h-5 w-5", spinning && "animate-spin")}
            strokeWidth={1.75}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

export /**
 * 主区只读编辑器。挂在 workspace-editor-surface > page-scroll-container 内，
 * 复用与主 Editor 完全一致的滚动容器和 max-w-4xl 包裹。
 */
function HistoryReader() {
  const {
    selectedContent,
    selectedVersionId,
    selectedStatus,
    isEmpty,
    indexError,
  } = useHistoryViewLogic();

  if (selectedStatus === "loading") {
    return (
      <HistoryReaderState
        icon={GooseIcons.LoaderCircle}
        title="正在读取历史版本"
        description="稍等片刻，正在准备只读预览。"
        spinning
      />
    );
  }

  if (isEmpty) {
    return (
      <HistoryReaderState
        icon={indexError ? GooseIcons.FileWarning : GooseIcons.History}
        title={indexError ? "历史列表无法读取" : "暂无历史版本"}
        description={
          indexError ?? "停笔一段时间后，鹅的笔记会自动保存可回看的历史。"
        }
      />
    );
  }

  if (selectedStatus === "missing") {
    return (
      <HistoryReaderState
        icon={GooseIcons.FileQuestion}
        title="此历史版本不可读取"
        description="版本文件为空或无法读取。若仓库在云盘上，请先恢复云盘登录后再打开历史。"
      />
    );
  }

  if (selectedStatus === "error") {
    return (
      <HistoryReaderState
        icon={GooseIcons.FileWarning}
        title="此历史版本格式异常"
        description="这条记录可能来自旧版格式或包含脏数据，已跳过渲染以避免白屏。"
      />
    );
  }

  if (!(selectedContent && selectedVersionId)) {
    return (
      <HistoryReaderState
        icon={GooseIcons.MousePointerClick}
        title="选择一个历史版本"
        description="从左侧列表选择时间点后，这里会显示只读预览。"
      />
    );
  }

  return (
    <ErrorBoundary
      resetKey={selectedVersionId}
      fallback={(_, reset) => (
        <HistoryReaderState
          icon={GooseIcons.FileWarning}
          title="此历史版本渲染失败"
          description="已阻止历史视图白屏。可以重试，或切换左侧其他历史版本。"
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="history-secondary-control mt-1 h-8 gap-1.5 rounded-[10px] text-xs shadow-none transition-[background-color,color,transform] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] active:translate-y-px active:bg-[var(--goose-interactive-selected)] active:text-[var(--goose-interactive-selected-fg)]"
              onClick={reset}
            >
              <GooseIcons.RotateCcw className="h-3.5 w-3.5" />
              重试
            </Button>
          }
        />
      )}
    >
      <HistoryReadOnlyEditor
        content={selectedContent}
        versionKey={selectedVersionId}
      />
    </ErrorBoundary>
  );
}
