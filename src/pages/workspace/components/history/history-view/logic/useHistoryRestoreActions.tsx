import { toast } from "@/components/ui/sonner";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import {
  markMilestone,
  recordHistorySnapshot,
  unmarkMilestone,
} from "@/lib/history/snapshot";
import { materializeVersion } from "@/lib/history/restore";
import { parseLocalFrontmatterBlob } from "@/lib/local-frontmatter";
import { createSafeHistoryContent } from "../historyViewPresentation";
import type { useHistoryViewState } from "./useHistoryViewState";

export function useHistoryRestoreActions(
  input: ReturnType<typeof useHistoryViewState>,
) {
  const {
    selectedVersionId,
    exit,
    bumpRefresh,
    getPage,
    updatePage,
    pageId,
    setIndex,
    isRestoring,
    setIsRestoring,
    pendingMilestoneVersionId,
    setPendingMilestoneVersionId,
  } = input;

  const handleRestore = () => {
    if (!pageId || !selectedVersionId || isRestoring) return;
    const current = getPage(pageId);
    if (!current) return;
    const ok = window.confirm(
      "确定还原到此历史版本？\n当前正文会自动保留为「还原前快照」，可随时恢复。",
    );
    if (!ok) return;
    setIsRestoring(true);

    try {
      flushEditorContent(true);
    } catch {
      /* ignore */
    }

    const latest = getPage(pageId);
    if (!latest) return;

    recordHistorySnapshot({
      pageId,
      workspaceId: latest.workspaceId,
      content: latest.content,
      trigger: "pre-op",
    }).catch((err) => console.error("[history] pre-op snapshot failed:", err));

    materializeVersion(pageId, selectedVersionId)
      .then((result) => {
        if (!result || result.content == null) {
          toast.error("无法读取该版本", {
            description:
              "版本文件为空或无法读取。若仓库在云盘上，请先恢复云盘登录。",
          });
          setIsRestoring(false);
          return;
        }
        const safeContent = createSafeHistoryContent(result.content);
        if (!safeContent) {
          toast.error("该历史版本格式异常，无法还原");
          setIsRestoring(false);
          return;
        }
        const updates: Parameters<typeof updatePage>[1] = {
          content: safeContent,
        };
        if (latest.localFilePath || result.localFrontmatter !== undefined) {
          updates.localFrontmatter = result.localFrontmatter;
          // 还原 frontmatter 时同步 goose 设置，避免随后写盘用当前内存设置覆盖
          const fm = parseLocalFrontmatterBlob(result.localFrontmatter);
          if (!fm.ok) {
            toast.error("该历史版本头部属性损坏，无法还原");
            setIsRestoring(false);
            return;
          }
          updates.fontFamily = fm.settings.fontFamily;
          updates.pageLayout = fm.settings.pageLayout;
          updates.isLocked = fm.settings.isLocked;
        }
        updatePage(pageId, updates);
        toast.success("已还原至所选版本，原内容已保留为快照");
        setIsRestoring(false);
        exit();
      })
      .catch((error) => {
        toast.error("无法读取该版本", {
          description: describeDiskWriteError(error),
        });
        setIsRestoring(false);
      });
  };

  const applyMilestoneLocally = (versionId: string, willBe: boolean) => {
    setIndex((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        versions: prev.versions.map((entry) =>
          entry.versionId === versionId
            ? { ...entry, isMilestone: willBe }
            : entry,
        ),
      };
    });
  };

  const handleToggleMilestone = (versionId: string, willBe: boolean) => {
    if (!pageId || pendingMilestoneVersionId) return;
    if (!willBe) {
      const ok = window.confirm(
        "确定取消里程碑标记？\n取消后该版本将恢复为普通快照，超出数量上限时可能被自动清理。",
      );
      if (!ok) return;
    }
    setPendingMilestoneVersionId(versionId);
    applyMilestoneLocally(versionId, willBe);
    const op = willBe
      ? markMilestone(pageId, versionId)
      : unmarkMilestone(pageId, versionId);
    op.then(() => {
      if (willBe) toast.success("已设为里程碑，该版本将长期保留");
      else toast.success("已取消里程碑");
      bumpRefresh();
    })
      .catch((err) => {
        console.error(
          `[history] ${willBe ? "markMilestone" : "unmarkMilestone"} failed:`,
          err,
        );
        applyMilestoneLocally(versionId, !willBe);
        toast.error(willBe ? "标记失败" : "取消标记失败", {
          description: describeDiskWriteError(err),
        });
      })
      .finally(() => setPendingMilestoneVersionId(null));
  };
  return {
    ...input,
    handleRestore,
    applyMilestoneLocally,
    handleToggleMilestone,
  };
}
