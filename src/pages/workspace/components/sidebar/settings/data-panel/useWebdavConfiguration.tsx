import {
  testWebdavConnection,
  listWebdavBackups,
  normalizeBaseUrl,
  normalizeRemoteDir,
} from "@/lib/webdavSync";
import { toast } from "@/components/ui/sonner";
import type { useDataPanelState } from "./useDataPanelState";

export function useWebdavConfiguration(
  input: ReturnType<typeof useDataPanelState>,
) {
  const {
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavAutoBackupEnabled,
    updateWebdavSettings,
    tempUrl,
    setTempUrl,
    tempUsername,
    tempPassword,
    setTempPassword,
    tempRemoteDir,
    setTempRemoteDir,
    tempRetentionDays,
    setTempRetentionDays,
    tempAutoBackupEnabled,
    setTesting,
    setRemoteLoading,
    isRemoteListOpen,
    setRemoteFiles,
    hasSavedConfig,
  } = input;

  const fetchRemoteList = async () => {
    if (!hasSavedConfig) return;
    setRemoteLoading(true);
    try {
      const list = await listWebdavBackups(
        webdavUrl,
        webdavUsername,
        webdavPassword,
        webdavRemoteDir,
      );
      setRemoteFiles(list);
    } catch (err) {
      console.error(err);
      toast.error("加载远端列表失败");
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleSaveAndTest = async () => {
    setTesting(true);
    const pwdToUse = tempPassword ? tempPassword : webdavPassword;

    let cleanUrl: string;
    let cleanDir: string;
    try {
      cleanUrl = normalizeBaseUrl(tempUrl);
    } catch (err: any) {
      toast.error("保存失败", {
        description: err.message || "服务地址格式不正确",
      });
      setTesting(false);
      return;
    }

    try {
      cleanDir = normalizeRemoteDir(tempRemoteDir);
    } catch (err: any) {
      toast.error("保存失败", {
        description: err.message || "远端目录格式不正确",
      });
      setTesting(false);
      return;
    }

    let cleanDays = tempRetentionDays;
    if (!Number.isInteger(cleanDays) || cleanDays < 1 || cleanDays > 365) {
      cleanDays = Math.max(1, Math.min(365, cleanDays || 365));
    }

    setTempUrl(cleanUrl);
    setTempRemoteDir(cleanDir);
    setTempRetentionDays(cleanDays);

    try {
      const result = await testWebdavConnection(
        cleanUrl,
        tempUsername,
        pwdToUse,
        cleanDir,
      );
      if (result.ok) {
        updateWebdavSettings({
          webdavUrl: cleanUrl,
          webdavUsername: tempUsername,
          webdavPassword: pwdToUse,
          webdavRemoteDir: cleanDir,
          webdavRetentionDays: cleanDays,
          webdavAutoBackupEnabled: tempAutoBackupEnabled,
        });
        setTempPassword("");
        toast.success("配置已保存，连接测试成功");
        if (isRemoteListOpen) {
          const list = await listWebdavBackups(
            cleanUrl,
            tempUsername,
            pwdToUse,
            cleanDir,
          );
          setRemoteFiles(list);
        }
      } else {
        toast.error("连接测试失败", { description: result.message });
      }
    } catch (err: any) {
      toast.error("操作失败", { description: err.message || String(err) });
    } finally {
      setTesting(false);
    }
  };
  return { ...input, fetchRemoteList, handleSaveAndTest };
}
