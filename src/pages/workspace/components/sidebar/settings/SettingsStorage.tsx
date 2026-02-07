import { useState } from "react";
import { Database, FileText, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectableCard } from "@/components/ui/selectable-card";
import { useSettings } from "@/stores/useSettings";
import { hostRuntime } from "@/lib/host";
import { initializeStorage } from "@/lib/tauri-storage";
import type { StorageMode } from "@/lib/tauri-storage/types";
import { SettingsSectionCard } from "./SettingsSectionCard";

const STORAGE_MODE_LABELS: Record<StorageMode, string> = {
  "markdown-only": "纯 Markdown 模式",
  hybrid: "双写模式（推荐）",
  "database-only": "数据库存储",
};

const STORAGE_MODE_DESCRIPTIONS: Record<StorageMode, string> = {
  "markdown-only": "所有笔记以标准 Markdown 文件保存，可用任何编辑器打开",
  hybrid: "Markdown 文件 + SQLite 索引，兼顾兼容性和性能",
  "database-only": "仅使用数据库存储（传统模式）",
};

export function SettingsStorage() {
  const { desktop, updateStorageSettings, setStorageWorkspacePath } = useSettings();
  const storage = desktop.storage;
  const [isSelectingPath, setIsSelectingPath] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 只在 Tauri 端显示
  if (!hostRuntime.isTauri) {
    return null;
  }

  const handleModeChange = async (mode: StorageMode) => {
    if (mode === storage?.mode) return;

    updateStorageSettings?.({ mode });

    // 如果已经设置了工作区路径，重新初始化存储
    if (storage?.workspacePath) {
      setIsInitializing(true);
      try {
        await initializeStorage({
          ...storage,
          mode,
        });
      } catch (error) {
        console.error("Failed to switch storage mode:", error);
      } finally {
        setIsInitializing(false);
      }
    }
  };

  const handleSelectWorkspace = async () => {
    setIsSelectingPath(true);
    try {
      const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");
      const selected = tauriGooseFs.selectDirectory
        ? await tauriGooseFs.selectDirectory()
        : null;
      if (selected) {
        setStorageWorkspacePath?.(selected);

        // 初始化存储
        if (storage) {
          await initializeStorage({
            ...storage,
            workspacePath: selected,
          });
        }
      }
    } catch (error) {
      console.error("Failed to select workspace:", error);
    } finally {
      setIsSelectingPath(false);
    }
  };

  const currentMode = storage?.mode || "hybrid";

  return (
    <SettingsSectionCard
      title="数据存储"
      description="选择适合你的数据存储方式（仅桌面端可用）"
    >
      <div className="space-y-3">
        <SelectableCard
          selected={currentMode === "markdown-only"}
          onClick={() => handleModeChange("markdown-only")}
          className="flex items-start gap-3 p-4"
        >
          <FileText className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">{STORAGE_MODE_LABELS["markdown-only"]}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {STORAGE_MODE_DESCRIPTIONS["markdown-only"]}
            </p>
          </div>
        </SelectableCard>

        <SelectableCard
          selected={currentMode === "hybrid"}
          onClick={() => handleModeChange("hybrid")}
          className="flex items-start gap-3 p-4"
        >
          <Database className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium flex items-center gap-2">
              {STORAGE_MODE_LABELS["hybrid"]}
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                推荐
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {STORAGE_MODE_DESCRIPTIONS["hybrid"]}
            </p>
          </div>
        </SelectableCard>
      </div>

      {/* 工作区路径设置 */}
      <div className="mt-6 pt-6 border-t">
        <Label className="text-base font-medium">工作区位置</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          所有笔记数据将保存在此文件夹中
        </p>

        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
            {storage?.workspacePath || "未选择"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectWorkspace}
            disabled={isSelectingPath}
          >
            {isSelectingPath ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4 mr-1" />
            )}
            选择文件夹
          </Button>
        </div>

        {!storage?.workspacePath && (
          <p className="text-xs text-amber-500 mt-2">
            请先选择工作区文件夹才能开始使用 Markdown 存储
          </p>
        )}
      </div>

      {/* 双写模式的高级选项 */}
      {storage?.mode === "hybrid" && (
        <div className="mt-6 pt-6 border-t space-y-4">
          <Label className="text-base font-medium">高级选项</Label>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="search-index" className="text-sm font-medium">
                启用全文搜索
              </Label>
              <p className="text-xs text-muted-foreground">
                使用 SQLite FTS 加速搜索，占用少量额外空间
              </p>
            </div>
            <Switch
              id="search-index"
              checked={storage?.searchIndexEnabled}
              onCheckedChange={(checked) =>
                updateStorageSettings?.({ searchIndexEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="frontmatter" className="text-sm font-medium">
                启用 YAML Frontmatter
              </Label>
              <p className="text-xs text-muted-foreground">
                在 Markdown 文件中保存元数据（标题、图标等）
              </p>
            </div>
            <Switch
              id="frontmatter"
              checked={storage?.frontmatterEnabled}
              onCheckedChange={(checked) =>
                updateStorageSettings?.({ frontmatterEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync" className="text-sm font-medium">
                自动同步索引
              </Label>
              <p className="text-xs text-muted-foreground">
                检测到文件变化时自动更新搜索索引
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={storage?.autoSync}
              onCheckedChange={(checked) =>
                updateStorageSettings?.({ autoSync: checked })
              }
            />
          </div>
        </div>
      )}

      {/* 初始化状态 */}
      {isInitializing && (
        <div className="mt-4 p-4 bg-muted rounded-lg flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">正在切换存储模式...</span>
        </div>
      )}

      {/* 说明文字 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">💡 提示</p>
        <p>
          切换存储模式不会影响现有数据。你的笔记始终以 Markdown 格式保存，
          可以随时用其他编辑器打开。
        </p>
      </div>
    </SettingsSectionCard>
  );
}
