import { Download, FileText, Globe, RotateCcw, Upload } from "lucide-react";
import type { ExportOptions } from "@/lib/export";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { renderNotebookIcon } from "../notebookUtils";

interface NotebookOption {
  id: string;
  name: string;
  icon?: string;
}

interface SettingsDataPanelProps {
  importing: boolean;
  onImport: () => void;
  selectedIds: string[];
  notebookList: NotebookOption[];
  onToggleNotebook: (id: string) => void;
  onSelectAll: () => void;
  format: ExportOptions["format"];
  onFormatChange: (format: ExportOptions["format"]) => void;
  exporting: boolean;
  onExport: () => void;
  onOpenResetDialog: () => void;
}

const DATA_BADGE_CLASS =
  "rounded-full bg-[hsl(var(--goose-selected-bg)/0.9)] px-2 py-0.5 text-[11px] text-foreground/75 dark:bg-[hsl(var(--foreground)/0.1)]";

const DATA_UNSELECTED_CARD_CLASS =
  "border-transparent bg-[hsl(var(--goose-selected-bg)/0.58)] hover:bg-[var(--goose-interactive-hover)] dark:bg-[hsl(var(--foreground)/0.08)]";

export function SettingsDataPanel({
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
}: SettingsDataPanelProps) {
  const selectedCount = selectedIds.length;
  const totalCount = notebookList.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">
          数据管理
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          管理记事本的导入和导出。
        </p>
      </div>

      <SettingsSectionCard
        title={<span className="flex items-center gap-2"><Download className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />导入与导出</span>}
        description="导入选 ZIP 文件；导出时会弹出系统保存对话框让你选路径。"
        actions={
          <Button variant="secondary" size="sm" onClick={onImport} disabled={importing}>
            {importing ? "导入中..." : "导入 ZIP"}
            {!importing && <Upload className="ml-2 h-4 w-4" />}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground/80">
              选择记事本 ({selectedCount})
            </Label>
            <div className="flex items-center gap-2">
              <span className={DATA_BADGE_CLASS}>
                已选 {selectedCount}/{totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-8 rounded-[10px] px-2 text-xs text-foreground/75 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
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
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-transparent bg-[var(--goose-interactive-selected)] text-foreground"
                      : DATA_UNSELECTED_CARD_CLASS,
                  )}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5">
                    {renderNotebookIcon(notebook.icon || "BookOpen", "h-4 w-4 stroke-[1.6]")}
                  </span>
                  <span className="truncate text-sm">{notebook.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">导出格式</Label>
          <div className="grid grid-cols-2 gap-2">
            <SelectableCard
              selected={format === "md"}
              onClick={() => onFormatChange("md")}
              className={cn(
                "flex h-16 items-center gap-3 rounded-[12px] border px-3 py-2 transition-all duration-200",
                format === "md"
                  ? "border-transparent bg-[var(--goose-interactive-selected)] text-foreground"
                  : DATA_UNSELECTED_CARD_CLASS,
              )}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Markdown</div>
                <div className="text-xs text-foreground/70">.md 文件</div>
              </div>
            </SelectableCard>
            <SelectableCard
              selected={format === "html"}
              onClick={() => onFormatChange("html")}
              className={cn(
                "flex h-16 items-center gap-3 rounded-[12px] border px-3 py-2 transition-all duration-200",
                format === "html"
                  ? "border-transparent bg-[var(--goose-interactive-selected)] text-foreground"
                  : DATA_UNSELECTED_CARD_CLASS,
              )}
            >
              <Globe className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">HTML</div>
                <div className="text-xs text-foreground/70">网页文件</div>
              </div>
            </SelectableCard>
          </div>
        </div>

        <Button
          className="w-full rounded-[12px]"
          onClick={onExport}
          disabled={selectedCount === 0 || exporting}
        >
          {exporting ? "导出中..." : "开始导出"}
          {!exporting && <Download className="ml-2 h-4 w-4" />}
        </Button>
        <p className="text-xs text-foreground/70">
          建议在重置前先导出备份，避免误删造成数据丢失。
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        tone="danger"
        title={<span className="flex items-center gap-2"><RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />重置所有数据</span>}
        description="会清空所有记事本和页面，无法撤销，操作前建议先导出备份。"
        actions={
          <Button variant="destructive" size="sm" onClick={onOpenResetDialog}>
            重置所有数据
          </Button>
        }
      >
      </SettingsSectionCard>
    </div>
  );
}
