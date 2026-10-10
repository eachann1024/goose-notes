import {
  Download,
  FileText,
  Globe,
  RotateCcw,
  Upload,
} from "@/components/ui/icons";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "../SettingsSectionCard";
import { renderNotebookIcon } from "../../notebookUtils";
import type { useWebdavRemoteActions } from "./useWebdavRemoteActions";
import { DATA_BADGE_CLASS, DATA_UNSELECTED_CARD_CLASS } from "./shared";

export function renderDataImportExport(
  context: ReturnType<typeof useWebdavRemoteActions>,
) {
  const {
    importing,
    onImport,
    selectedIds,
    notebookList,
    onToggleNotebook,
    onSelectAll,
    format,
    onFormatChange,
    exporting,
    onExport,
    onOpenResetDialog,
    selectedCount,
    totalCount,
  } = context;
  return (
    <div className="space-y-2">
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2">
            <Download
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            导入与导出
          </span>
        }
        description="支持导入与导出标准 ZIP 备份包；导出时可自定义文件保存位置与格式。"
        className="pb-3"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={onImport}
            disabled={importing}
          >
            {importing ? "正在导入…" : "导入 ZIP"}
            {!importing && <Upload className="ml-2 h-4 w-4" />}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">
              选择笔记本 ({selectedCount})
            </Label>
            <div className="flex items-center gap-2">
              <span className={DATA_BADGE_CLASS}>
                已选 {selectedCount}/{totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-8 rounded-[10px] px-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
              >
                {selectedCount === totalCount ? "取消全选" : "全选"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {notebookList.map((notebook) => {
              const isSelected = selectedIds.includes(notebook.id);
              return (
                <button
                  key={notebook.id}
                  type="button"
                  onClick={() => onToggleNotebook(notebook.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-left transition-all duration-200",
                    "",
                    isSelected
                      ? "border-transparent bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                      : DATA_UNSELECTED_CARD_CLASS,
                  )}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5">
                    {renderNotebookIcon(
                      notebook.icon || "BookOpen",
                      "h-4 w-4 stroke-[1.6]",
                    )}
                  </span>
                  <span className="truncate text-sm">{notebook.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            导出格式
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <SelectableCard
              selected={format === "md"}
              onClick={() => onFormatChange("md")}
              className={cn(
                "flex h-16 items-center gap-3 rounded-[12px] border px-3 py-2 transition-all duration-200",
                format === "md"
                  ? "border-transparent bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                  : DATA_UNSELECTED_CARD_CLASS,
              )}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Markdown (.md)</div>
                <div className="text-xs text-muted-foreground">通用纯文本格式，包含独立资源文件</div>
              </div>
            </SelectableCard>
            <SelectableCard
              selected={format === "html"}
              onClick={() => onFormatChange("html")}
              className={cn(
                "flex h-16 items-center gap-3 rounded-[12px] border px-3 py-2 transition-all duration-200",
                format === "html"
                  ? "border-transparent bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                  : DATA_UNSELECTED_CARD_CLASS,
              )}
            >
              <Globe className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">HTML (.html)</div>
                <div className="text-xs text-muted-foreground">富文本网页格式，完整保留排版与样式</div>
              </div>
            </SelectableCard>
          </div>
        </div>

        <Button
          className="w-full rounded-[12px]"
          onClick={onExport}
          disabled={selectedCount === 0 || exporting}
        >
          {exporting ? "正在导出…" : "开始导出"}
          {!exporting && <Download className="ml-2 h-4 w-4" />}
        </Button>
        <p className="text-xs text-muted-foreground">
          建议在重置前先导出备份，避免误删造成数据丢失。
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        tone="danger"
        className="pt-3"
        title={
          <span className="flex items-center gap-2">
            <RotateCcw
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            重置所有数据
          </span>
        }
        description="此操作将清空内部笔记本、页面、编辑历史、AI 对话及偏好设置；本地文件夹中的物理文件不受影响。操作前建议先导出备份。"
        actions={
          <Button variant="destructive" size="sm" onClick={onOpenResetDialog}>
            重置所有数据
          </Button>
        }
      />
    </div>
  );
}
