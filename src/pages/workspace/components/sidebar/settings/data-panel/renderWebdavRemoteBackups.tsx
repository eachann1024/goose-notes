import {
  Download,
  CloudOff,
  RefreshCw,
  ChevronRight,
  Trash2,
} from "@/components/ui/icons";
import { SettingsSectionCard } from "../SettingsSectionCard";
import type { useWebdavRemoteActions } from "./useWebdavRemoteActions";
import { formatFileSize, formatRemoteTime } from "./shared";

export function renderWebdavRemoteBackups(
  context: ReturnType<typeof useWebdavRemoteActions>,
) {
  const {
    remoteLoading,
    isRemoteListOpen,
    showAllRemote,
    setShowAllRemote,
    remoteFiles,
    restoringFile,
    deletingFile,
    busy,
    hasSavedConfig,
    fetchRemoteList,
    toggleRemoteList,
    handleRestore,
    handleDelete,
    visibleRemoteFiles,
  } = context;
  return (
    <SettingsSectionCard
      className="pt-3"
      title={
        <button
          type="button"
          className="flex items-center gap-2 text-left "
          onClick={toggleRemoteList}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isRemoteListOpen && "rotate-90",
            )}
          />
          <span>远端备份</span>
        </button>
      }
      description="管理云盘中的打包备份文件。"
      actions={
        isRemoteListOpen && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !hasSavedConfig}
            onClick={fetchRemoteList}
            className="h-8 rounded-[10px] px-2 text-xs hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", remoteLoading && "animate-spin")}
            />
          </Button>
        )
      }
    >
      {isRemoteListOpen && (
        <div className="space-y-3 pt-2">
          {remoteLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>正在加载远端备份</span>
            </div>
          ) : remoteFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 border border-dashed rounded-[12px] border-muted py-6 text-center">
              <CloudOff
                className="h-6 w-6 text-muted-foreground"
                strokeWidth={1.75}
              />
              <p className="text-xs font-medium text-foreground">
                暂无远端备份
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                保存连接配置后，点击「生成并上传」即可创建云端备份
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleRemoteFiles.map((file) => {
                const isRestoring = restoringFile === file.basename;
                const isDeleting = deletingFile === file.basename;
                return (
                  <div
                    key={file.basename}
                    className="flex flex-col gap-2 rounded-[12px] border p-3 bg-[hsl(var(--goose-selected-bg)/0.38)] dark:bg-[hsl(var(--foreground)/0.04)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p
                        className="text-sm font-medium truncate max-w-[280px] sm:max-w-[400px]"
                        title={file.basename}
                      >
                        {file.basename}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>时间：{formatRemoteTime(file.lastmod)}</span>
                        <span>大小：{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 rounded-[10px] text-xs flex items-center gap-1"
                        disabled={busy}
                        onClick={() => handleRestore(file)}
                      >
                        {isRestoring ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        恢复
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 rounded-[10px] text-xs flex items-center gap-1"
                        disabled={busy}
                        onClick={() => handleDelete(file)}
                      >
                        {isDeleting ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}

              {remoteFiles.length > 3 && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRemote((prev) => !prev)}
                    className="text-xs hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  >
                    {showAllRemote
                      ? "收起备份"
                      : `展开全部远端备份 (还有 ${remoteFiles.length - 3} 个)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </SettingsSectionCard>
  );
}
