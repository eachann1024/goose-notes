import MarkdownIt from "markdown-it";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiWritePlan } from "@/lib/ai-write";

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).enable("table");

interface AiWritePreviewCardProps {
  plan: AiWritePlan;
  applying?: boolean;
  onConfirm: (plan: AiWritePlan) => void | Promise<void>;
  onCancel: (plan: AiWritePlan) => void;
  onOpenResult?: (pageId: string) => void;
}

function getStatusMeta(plan: AiWritePlan) {
  if (plan.status === "committed") {
    return {
      label: "已写入",
      tone: "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
      icon: LucideIcons.CheckCircle2,
    };
  }

  if (plan.status === "cancelled") {
    return {
      label: "已取消",
      tone: "border-border/70 bg-muted/35 text-muted-foreground",
      icon: LucideIcons.CircleSlash2,
    };
  }

  return {
    label: "待确认",
    tone: "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    icon: LucideIcons.Clock3,
  };
}

export function AiWritePreviewCard({
  plan,
  applying = false,
  onConfirm,
  onCancel,
  onOpenResult,
}: AiWritePreviewCardProps) {
  const statusMeta = getStatusMeta(plan);
  const StatusIcon = statusMeta.icon;

  return (
    <div className="mt-3 overflow-hidden rounded-[20px] border border-border/70 bg-background/85">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <LucideIcons.FilePenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {plan.previewTitle}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium",
            statusMeta.tone,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[12px] text-muted-foreground">
        <span>{plan.target.targetLabel}</span>
        <span className="text-border">·</span>
        <span>{plan.action === "append_page" ? "追加内容" : plan.action === "replace_page" ? "覆盖页面" : "新建页面"}</span>
      </div>

      <div className="max-h-[320px] overflow-y-auto border-y border-border/60 px-4 py-4">
        <div
          className="ai-markdown break-words text-sm leading-7"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: md.render(plan.outputMarkdown) }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3">
        {plan.status === "committed" && plan.committedPageId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenResult?.(plan.committedPageId!)}
          >
            打开结果
          </Button>
        ) : null}
        {plan.status === "pending" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onCancel(plan)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={applying}
              onClick={() => void onConfirm(plan)}
            >
              {applying ? (
                <>
                  <LucideIcons.LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  写入中
                </>
              ) : (
                "确认写入"
              )}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
