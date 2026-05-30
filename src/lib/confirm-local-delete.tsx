import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { FeatureToastCard } from "@/components/ui/feature-toast-card";
import { getPageTitle } from "@/lib/page-title";
import type { Page } from "@/types";

/**
 * 本地文件/文件夹删除的非阻塞确认（替代 window.confirm）。
 * 返回 Promise<boolean>：用户点「删除」resolve(true)，点「取消」或关闭 resolve(false)。
 * 文案明确告知会移入系统回收站、不可在应用内撤回。
 */
export function confirmLocalDelete(page: Page): Promise<boolean> {
  const title = getPageTitle(page) || "无标题";
  const isFolder = !!page.isFolder;

  return new Promise<boolean>((resolve) => {
    const toastId = `confirm-local-delete-${page.id}`;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      toast.dismiss(toastId);
      resolve(ok);
    };

    toast.custom(
      () => (
        <FeatureToastCard
          icon={<LucideIcons.Trash2 className="h-5 w-5" />}
          title={isFolder ? `删除本地文件夹「${title}」？` : `删除本地文件「${title}」？`}
          actions={[
            {
              label: "删除",
              variant: "destructive",
              onClick: () => finish(true),
            },
            {
              label: "取消",
              variant: "ghost",
              className: "text-muted-foreground hover:text-foreground",
              onClick: () => finish(false),
            },
          ]}
        >
          <p>
            {isFolder
              ? "文件夹及其内容将移入系统回收站。"
              : "对应文件将移入系统回收站。"}
          </p>
          <p>系统回收站不可在应用内撤回。</p>
        </FeatureToastCard>
      ),
      {
        id: toastId,
        duration: Infinity,
        position: "bottom-right",
        onDismiss: () => finish(false),
        onAutoClose: () => finish(false),
      },
    );
  });
}
