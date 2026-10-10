import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "../../settings/SettingsSectionCard";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "@/components/ui/sonner";
import { HostAdapter } from "@/lib/host/adapter";
import { PAGE_DOC_PREFIX } from "@/lib/storage/pageRepository";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { Page } from "@/types";

export /** 检测 db 中残留的内置（非本地文件）页面——桌面模式下用于一次性导出。 */
function listLegacyInternalPages(): Page[] {
  try {
    return HostAdapter.db
      .allDocs<Page>(PAGE_DOC_PREFIX)
      .map((doc) => doc.data)
      .filter((page) => page && !page.localFilePath && !page.trashedAt);
  } catch {
    return [];
  }
}

export /** 桌面端专属：检测到旧内置（web-db）页面时，提供一次性导出为 .md 到当前仓库。 */
function LegacyInternalPagesExportCard() {
  const [exporting, setExporting] = useState(false);
  const [legacyCount, setLegacyCount] = useState(
    () => listLegacyInternalPages().length,
  );
  if (legacyCount <= 0) return null;

  const handleExport = async () => {
    const notebookState = useNotebooks.getState();
    const activeNotebook = notebookState.activeNotebookId
      ? notebookState.notebooks[notebookState.activeNotebookId]
      : null;
    if (
      activeNotebook?.source !== "local-folder" ||
      !activeNotebook.localPath ||
      !window.gooseFs
    ) {
      toast.error("请先打开本地文件夹", {
        description: "请切换到目标文件夹后再执行数据导出。",
      });
      return;
    }

    setExporting(true);
    try {
      const { blocksToMarkdown } = await import("@/lib/export");
      const gooseFs = window.gooseFs!;
      const basePath = activeNotebook.localPath.replace(/[\\/]+$/, "");
      const separator = activeNotebook.localPath.includes("\\") ? "\\" : "/";
      const legacyPages = listLegacyInternalPages();

      let exported = 0;
      for (const page of legacyPages) {
        const title = (getPageTitle(page) || "无标题")
          .trim()
          .replace(/[\\/:*?"<>|]/g, "_");
        const markdown = await blocksToMarkdown(page.content as never);
        let filePath = `${basePath}${separator}${title}.md`;
        let suffix = 1;
        const exists = async (path: string) =>
          gooseFs.existsAsync
            ? await gooseFs.existsAsync(path)
            : gooseFs.exists(path);
        while (await exists(filePath)) {
          filePath = `${basePath}${separator}${title} (${suffix}).md`;
          suffix += 1;
        }
        const ok = gooseFs.writeFileAsync
          ? await gooseFs.writeFileAsync(filePath, markdown)
          : gooseFs.writeFile(filePath, markdown);
        if (ok) exported += 1;
      }

      toast.success(`已导出 ${exported} 篇早期内置笔记`, {
        description: `文件已写入 ${basePath}；原始数据已完整保留。`,
      });
      await usePages
        .getState()
        .loadLocalFolderPages(activeNotebook.id, activeNotebook.localPath);
    } catch (error) {
      console.error("[settings] 导出旧内置笔记失败", error);
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
      setLegacyCount(listLegacyInternalPages().length);
    }
  };

  return (
    <SettingsSectionCard title="旧数据迁移">
      <div className="flex items-start justify-between gap-4 rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)] px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            检测到早期内置笔记 ({legacyCount} 篇)
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            这些笔记保存在旧版本的内部数据库中，未显示在文件侧栏中。可将其批量导出为
            Markdown 格式存入当前本地文件夹；导出操作不会删除原始数据。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="shrink-0"
        >
          {exporting ? "导出中…" : "导出到当前文件夹"}
        </Button>
      </div>
    </SettingsSectionCard>
  );
}
