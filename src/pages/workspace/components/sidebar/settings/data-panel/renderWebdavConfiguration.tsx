import { Upload, Cloud, RefreshCw } from "@/components/ui/icons";
import { SettingsSectionCard } from "../SettingsSectionCard";
import type { useWebdavRemoteActions } from "./useWebdavRemoteActions";

export function renderWebdavConfiguration(
  context: ReturnType<typeof useWebdavRemoteActions>,
) {
  const {
    webdavPassword,
    tempUrl,
    setTempUrl,
    tempUsername,
    setTempUsername,
    tempPassword,
    setTempPassword,
    tempRemoteDir,
    setTempRemoteDir,
    tempRetentionDays,
    setTempRetentionDays,
    tempAutoBackupEnabled,
    setTempAutoBackupEnabled,
    testing,
    uploading,
    syncingLatest,
    busy,
    hasSavedConfig,
    lastUploadText,
    lastDownloadText,
    handleSaveAndTest,
    handleUploadNow,
    handleSyncLatest,
  } = context;
  return (
    <SettingsSectionCard
      title={
        <span className="flex items-center gap-2">
          <Cloud
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          WebDAV 配置
        </span>
      }
      description="配置 WebDAV 服务以同步并自动管理云端备份。"
      className="pb-3"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            服务地址
          </Label>
          <input
            className="flex h-9 w-full rounded-[12px] border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
            value={tempUrl}
            disabled={busy}
            onChange={(e) => setTempUrl(e.target.value)}
            placeholder="例如 https://example.com/dav/"
          />
          <p className="text-[11px] text-muted-foreground">
            示例地址：https://example.com/dav/
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">账号</Label>
            <input
              className="flex h-9 w-full rounded-[12px] border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
              value={tempUsername}
              disabled={busy}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="邮箱或用户名"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              远端目录
            </Label>
            <input
              className="flex h-9 w-full rounded-[12px] border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
              value={tempRemoteDir}
              disabled={busy}
              onChange={(e) => setTempRemoteDir(e.target.value)}
              placeholder="备份目录"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              应用密码
            </Label>
            <input
              type="password"
              className="flex h-9 w-full rounded-[12px] border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
              value={tempPassword}
              disabled={busy}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder={
                webdavPassword ? "已保存，留空保持不变" : "第三方应用密码"
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              云端保留天数
            </Label>
            <input
              type="number"
              min={1}
              max={365}
              className="flex h-9 w-full rounded-[12px] border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
              value={tempRetentionDays}
              disabled={busy}
              onChange={(e) =>
                setTempRetentionDays(parseInt(e.target.value) || 30)
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[12px] border border-muted/20 p-3 bg-muted/10">
          <div className="space-y-0.5 pr-4">
            <Label className="text-xs font-medium text-foreground">
              自动云备份
            </Label>
            <p className="text-[11px] text-muted-foreground">
              应用启动且闲置时，若距离上次备份已超过 24
              小时，自动在后台生成并上传备份
            </p>
          </div>
          <Switch
            checked={tempAutoBackupEnabled}
            onCheckedChange={setTempAutoBackupEnabled}
            disabled={busy}
          />
        </div>

        <div className="rounded-[12px] border border-transparent bg-[hsl(var(--goose-selected-bg)/0.58)] p-3 text-xs text-foreground dark:bg-[hsl(var(--foreground)/0.08)]">
          <div className="flex flex-col gap-1.5">
            <div>
              <strong>最近上传：</strong>
              <span>{lastUploadText}</span>
            </div>
            <div>
              <strong>最近恢复：</strong>
              <span>{lastDownloadText}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full pt-2">
          <Button
            className="w-full flex items-center justify-center gap-1.5 rounded-[12px]"
            disabled={busy}
            onClick={handleSaveAndTest}
          >
            {testing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            保存并测试连接
          </Button>
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-1.5 rounded-[12px]"
            disabled={busy || !hasSavedConfig}
            onClick={handleUploadNow}
          >
            {uploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            生成并上传
          </Button>
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-1.5 rounded-[12px]"
            disabled={busy || !hasSavedConfig}
            onClick={handleSyncLatest}
          >
            {syncingLatest ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            从云端拉取恢复
          </Button>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
