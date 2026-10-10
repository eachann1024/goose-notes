import { renderWebdavRemoteBackups } from "./data-panel/renderWebdavRemoteBackups";
import { renderWebdavConfiguration } from "./data-panel/renderWebdavConfiguration";
import { renderDataImportExport } from "./data-panel/renderDataImportExport";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { type SettingsDataPanelProps } from "./data-panel/shared";
import { useDataPanelState } from "./data-panel/useDataPanelState";
import { useWebdavConfiguration } from "./data-panel/useWebdavConfiguration";
import { useWebdavSyncActions } from "./data-panel/useWebdavSyncActions";
import { useWebdavRemoteActions } from "./data-panel/useWebdavRemoteActions";

export function SettingsDataPanel(props: SettingsDataPanelProps) {
  const data = useDataPanelState(props);
  const configuration = useWebdavConfiguration(data);
  const sync = useWebdavSyncActions(configuration);
  const useWebdavRemoteActions = useWebdavRemoteActions(sync);
  const context = useWebdavRemoteActions;
  const {
    active,
    onRestartGuide,
    confirmConfig,
    setConfirmConfig,
    activationRef,
  } = context;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        数据管理
      </h3>

      <SettingsSectionCard
        title="新手引导"
        description="重新选择书写布局与阅读偏好，已有笔记保持不变。"
        actions={
          <Button variant="outline" onClick={onRestartGuide}>
            重新开始引导
          </Button>
        }
      />

      <div className="settings-data-grid">
        {renderDataImportExport(context)}

        <div className="space-y-2">
          {renderWebdavConfiguration(context)}

          {renderWebdavRemoteBackups(context)}
        </div>
      </div>

      <DialogShell
        open={active && (confirmConfig?.open || false)}
        onOpenChange={(open) => {
          if (!open) {
            confirmConfig?.onCancel?.();
            setConfirmConfig(null);
          }
        }}
        title={confirmConfig?.title}
      >
        <div className="px-6 pb-6 pt-4 space-y-4">
          <p className="text-sm text-muted-foreground break-all">
            {confirmConfig?.description}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-[10px]"
              onClick={() => {
                confirmConfig?.onCancel?.();
                setConfirmConfig(null);
              }}
            >
              取消
            </Button>
            <Button
              variant={confirmConfig?.isDestructive ? "destructive" : "default"}
              className="rounded-[10px]"
              onClick={async () => {
                if (!activationRef.current.active) return;
                const onConfirm = confirmConfig?.onConfirm;
                setConfirmConfig(null);
                if (onConfirm) {
                  await onConfirm();
                }
              }}
            >
              确定
            </Button>
          </div>
        </div>
      </DialogShell>
    </div>
  );
}
