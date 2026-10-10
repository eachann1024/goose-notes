import {
  listWebdavBackups,
  downloadWebdavBackup,
  deleteWebdavBackup,
  type WebdavBackupFile,
} from "@/lib/webdavSync";
import { toast } from "@/components/ui/sonner";
import type { useWebdavSyncActions } from "./useWebdavSyncActions";

export function useWebdavRemoteActions(
  input: ReturnType<typeof useWebdavSyncActions>,
) {
  const {
    active,
    onResetAndImport,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavLastDownloadAt,
    webdavLastDownloadFilename,
    updateWebdavSettings,
    showAllRemote,
    remoteFiles,
    setRemoteFiles,
    setRestoringFile,
    setDeletingFile,
    setConfirmConfig,
    activationRef,
    isCurrentActivation,
  } = input;

  const handleRestore = async (file: WebdavBackupFile) => {
    if (!activationRef.current.active) return;
    const epoch = activationRef.current.epoch;
    setConfirmConfig({
      open: true,
      title: "恢复云端备份",
      description: `确定使用云端备份「${file.basename}」恢复数据？恢复前将先校验完整性；若恢复中断，将自动还原当前本地数据。`,
      isDestructive: true,
      onConfirm: async () => {
        if (!isCurrentActivation(epoch)) return;
        setRestoringFile(file.basename);
        try {
          const blob = await downloadWebdavBackup(
            webdavUrl,
            webdavUsername,
            webdavPassword,
            webdavRemoteDir,
            file.basename,
          );
          if (!isCurrentActivation(epoch)) return;
          if (onResetAndImport) {
            await onResetAndImport(blob);
            updateWebdavSettings({
              webdavLastDownloadAt: new Date().toISOString(),
              webdavLastDownloadFilename: file.basename,
            });
          }
        } catch (err: any) {
          console.error(err);
          toast.error("恢复备份失败", {
            description: err.message || String(err),
          });
        } finally {
          setRestoringFile(null);
        }
      },
    });
  };

  const handleDelete = async (file: WebdavBackupFile) => {
    if (!activationRef.current.active) return;
    const epoch = activationRef.current.epoch;
    setConfirmConfig({
      open: true,
      title: "删除云端备份",
      description: `确定删除云端备份「${file.basename}」？删除后无法从云端找回。`,
      isDestructive: true,
      onConfirm: async () => {
        if (!isCurrentActivation(epoch)) return;
        setDeletingFile(file.basename);
        try {
          await deleteWebdavBackup(
            webdavUrl,
            webdavUsername,
            webdavPassword,
            webdavRemoteDir,
            file.basename,
          );
          toast.success("云端备份已删除");
          const list = await listWebdavBackups(
            webdavUrl,
            webdavUsername,
            webdavPassword,
            webdavRemoteDir,
          );
          setRemoteFiles(list);
        } catch (err: any) {
          console.error(err);
          toast.error("删除备份失败", {
            description: err.message || String(err),
          });
        } finally {
          setDeletingFile(null);
        }
      },
    });
  };

  const visibleRemoteFiles = showAllRemote
    ? remoteFiles
    : remoteFiles.slice(0, 3);
  return { ...input, handleRestore, handleDelete, visibleRemoteFiles };
}
