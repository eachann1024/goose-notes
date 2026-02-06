import { AlertTriangle, Check, Download, FileText, Globe, Upload } from "lucide-react";
import type { ExportOptions } from "@/lib/export";
import { SelectableCard } from "@/components/ui/selectable-card";
import { SettingsSectionCard } from "./SettingsSectionCard";

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
    <div className="space-y-4">
      <SettingsSectionCard
        title="数据管理"
        description="管理记事本的导入和导出"
        actions={
          <Button variant="secondary" size="sm" onClick={onImport} disabled={importing}>
            {importing ? "导入中..." : "导入 ZIP"}
            {!importing && <Upload className="ml-2 h-4 w-4" />}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              选择记事本 ({selectedCount})
            </Label>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[hsl(var(--goose-selected-bg)/0.9)] px-2 py-0.5 text-[11px] text-muted-foreground">
                已选 {selectedCount}/{totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-8 rounded-[10px] px-2 text-xs text-muted-foreground transition-colors hover:bg-[hsl(var(--goose-selected-bg)/0.76)] hover:text-foreground"
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
                    "flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "bg-[hsl(var(--goose-selected-bg))]"
                      : "bg-[hsl(var(--goose-selected-bg)/0.58)] hover:bg-[hsl(var(--goose-selected-bg)/0.76)]",
                  )}
                >
                  <span className="shrink-0 text-lg">{notebook.icon || "📓"}</span>
                  <span className="truncate text-sm">{notebook.name}</span>
                  {isSelected ? (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-foreground/75" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">导出格式</Label>
          <div className="grid grid-cols-2 gap-2">
            <SelectableCard
              selected={format === "md"}
              onClick={() => onFormatChange("md")}
              className="flex h-16 items-center gap-3 rounded-[12px] border-0 bg-[hsl(var(--goose-selected-bg)/0.58)] px-3 py-2 hover:bg-[hsl(var(--goose-selected-bg)/0.76)]"
            >
              <FileText className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Markdown</div>
                <div className="text-xs text-muted-foreground">.md 文件</div>
              </div>
            </SelectableCard>
            <SelectableCard
              selected={format === "html"}
              onClick={() => onFormatChange("html")}
              className="flex h-16 items-center gap-3 rounded-[12px] border-0 bg-[hsl(var(--goose-selected-bg)/0.58)] px-3 py-2 hover:bg-[hsl(var(--goose-selected-bg)/0.76)]"
            >
              <Globe className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">HTML</div>
                <div className="text-xs text-muted-foreground">网页文件</div>
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
        <p className="text-xs text-muted-foreground">
          建议在重置前先导出备份，避免误删造成数据丢失。
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        tone="danger"
        title="重置所有数据"
        description="删除所有记事本和页面，此操作不可撤销"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onExport}
              disabled={selectedCount === 0 || exporting}
            >
              先导出备份
            </Button>
            <Button variant="destructive" size="sm" onClick={onOpenResetDialog}>
              重置所有数据
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 rounded-[12px] bg-destructive/10 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">危险操作提醒</p>
            <p className="text-xs text-muted-foreground">
              建议先导出备份，再执行重置。
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
