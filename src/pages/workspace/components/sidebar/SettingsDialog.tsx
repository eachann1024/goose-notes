import { renderSettingsResetDialog } from "./settings-dialog/renderSettingsResetDialog";
import { renderSettingsScaffold } from "./settings-dialog/renderSettingsScaffold";
import { type SettingsDialogProps } from "./settings-dialog/shared";
import { useSettingsDialogState } from "./settings-dialog/useSettingsDialogState";
import { useSettingsImportExport } from "./settings-dialog/useSettingsImportExport";
import { useSettingsBackupRestore } from "./settings-dialog/useSettingsBackupRestore";
import { useSettingsResetActions } from "./settings-dialog/useSettingsResetActions";

export function SettingsDialog(props: SettingsDialogProps) {
  const settings = useSettingsDialogState(props);
  const importExport = useSettingsImportExport(settings);
  const backupRestore = useSettingsBackupRestore(importExport);
  const settingsResetActionsContext = useSettingsResetActions(backupRestore);
  const context = settingsResetActionsContext;
  const { open, hasOpened } = context;

  if (!open && !hasOpened) return null;

  return (
    <>
      {renderSettingsScaffold(context)}

      {renderSettingsResetDialog(context)}
    </>
  );
}
