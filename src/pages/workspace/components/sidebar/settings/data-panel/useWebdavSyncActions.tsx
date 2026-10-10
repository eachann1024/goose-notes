import { generateExportZip } from "@/lib/export";
import {
  listWebdavBackups,
  uploadWebdavBackup,
  downloadWebdavBackup,
} from "@/lib/webdavSync";
import { toast } from "@/components/ui/sonner";
import type { useWebdavConfiguration } from "./useWebdavConfiguration";

export function useWebdavSyncActions(
  input: ReturnType<typeof useWebdavConfiguration>,
) {
  const {
    active,
    notebookList,
    format,
    onResetAndImport,
    notebooks,
    pages,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavLastUploadAt,
    webdavLastUploadFilename,
    webdavLastDownloadAt,
    webdavLastDownloadFilename,
    updateWebdavSettings,
    setUploading,
    setSyncingLatest,
    isRemoteListOpen,
    setIsRemoteListOpen,
    setRemoteFiles,
    setConfirmConfig,
    activationRef,
    isCurrentActivation,
    hasSavedConfig,
    fetchRemoteList,
  } = input;

  const handleUploadNow = async () => {
    if (!activationRef.current.active) return;
    const epoch = activationRef.current.epoch;
    setUploading(true);
    try {
      const notebookIds = notebookList.map((n) => n.id);
      if (notebookIds.length === 0) {
        toast.error("无可导出的笔记本数据");
        setUploading(false);
        return;
      }
      const zipBlob = await generateExportZip(
        { format: "md", notebookIds },
        notebooks,
        Object.values(pages),
      );
      if (!isCurrentActivation(epoch)) return;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const fileName = `goose-note-export-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.zip`;

      const result = await uploadWebdavBackup(
        webdavUrl,
        webdavUsername,
        webdavPassword,
        webdavRemoteDir,
        webdavRetentionDays,
        zipBlob,
        fileName,
      );

      if (result.success) {
        updateWebdavSettings({
          webdavLastUploadAt: now.toISOString(),
          webdavLastUploadFilename: fileName,
        });
        toast.success("同步备份成功", {
          description: `已清理 ${result.cleanedCount} 个云端过期备份`,
        });
        if (isRemoteListOpen) {
          const list = await listWebdavBackups(
            webdavUrl,
            webdavUsername,
            webdavPassword,
            webdavRemoteDir,
          );
          setRemoteFiles(list);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("备份上传失败", { description: err.message || String(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleSyncLatest = async () => {
    if (!activationRef.current.active) return;
    const epoch = activationRef.current.epoch;
    setSyncingLatest(true);
    try {
      const list = await listWebdavBackups(
        webdavUrl,
        webdavUsername,
        webdavPassword,
        webdavRemoteDir,
      );
      if (!isCurrentActivation(epoch)) return;
      setRemoteFiles(list);
      if (list.length === 0) {
        toast.error("云端未发现可用的备份文件");
        setSyncingLatest(false);
        return;
      }
      const latest = list[0];
      setConfirmConfig({
        open: true,
        title: "从云端拉取恢复",
        description: `确认从云端恢复备份 ${latest.basename}？此操作将以该备份覆盖本地当前数据。恢复前会先校验备份，失败时自动回滚覆盖前的数据。`,
        isDestructive: true,
        onConfirm: async () => {
          if (!isCurrentActivation(epoch)) return;
          setSyncingLatest(true);
          try {
            const blob = await downloadWebdavBackup(
              webdavUrl,
              webdavUsername,
              webdavPassword,
              webdavRemoteDir,
              latest.basename,
            );
            if (!isCurrentActivation(epoch)) return;
            if (onResetAndImport) {
              await onResetAndImport(blob);
              updateWebdavSettings({
                webdavLastDownloadAt: new Date().toISOString(),
                webdavLastDownloadFilename: latest.basename,
              });
            }
          } catch (err: any) {
            if (!isCurrentActivation(epoch)) return;
            console.error(err);
            toast.error("同步失败", {
              description: err.message || String(err),
            });
          } finally {
            if (isCurrentActivation(epoch)) setSyncingLatest(false);
          }
        },
        onCancel: () => {
          if (isCurrentActivation(epoch)) setSyncingLatest(false);
        },
      });
    } catch (err: any) {
      if (!isCurrentActivation(epoch)) return;
      console.error(err);
      toast.error("同步失败", { description: err.message || String(err) });
      setSyncingLatest(false);
    }
  };

  const toggleRemoteList = () => {
    const next = !isRemoteListOpen;
    setIsRemoteListOpen(next);
    if (next && hasSavedConfig) {
      void fetchRemoteList();
    }
  };
  return { ...input, handleUploadNow, handleSyncLatest, toggleRemoteList };
}
