import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useSettings } from "@/stores/settings";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { type WebdavBackupFile } from "@/lib/webdavSync";
import { type SettingsDataPanelProps, formatRemoteTime } from "./shared";

export function useDataPanelState({
  active,
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
  onRestartGuide,
  onResetAndImport,
}: SettingsDataPanelProps) {
  const selectedCount = selectedIds.length;

  const totalCount = notebookList.length;

  const { notebooks } = useNotebooks();

  const { pages } = usePages();

  const {
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavAutoBackupEnabled,
    webdavLastUploadAt,
    webdavLastUploadFilename,
    webdavLastDownloadAt,
    webdavLastDownloadFilename,
    updateWebdavSettings,
  } = useSettings();

  const [tempUrl, setTempUrl] = useState(webdavUrl);

  const [tempUsername, setTempUsername] = useState(webdavUsername);

  const [tempPassword, setTempPassword] = useState("");

  const [tempRemoteDir, setTempRemoteDir] = useState(webdavRemoteDir);

  const [tempRetentionDays, setTempRetentionDays] =
    useState(webdavRetentionDays);

  const [tempAutoBackupEnabled, setTempAutoBackupEnabled] = useState(
    webdavAutoBackupEnabled,
  );

  const [testing, setTesting] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [syncingLatest, setSyncingLatest] = useState(false);

  const [remoteLoading, setRemoteLoading] = useState(false);

  const [isRemoteListOpen, setIsRemoteListOpen] = useState(false);

  const [showAllRemote, setShowAllRemote] = useState(false);

  const [remoteFiles, setRemoteFiles] = useState<WebdavBackupFile[]>([]);

  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  } | null>(null);

  const activationRef = useRef({ active, epoch: 0 });

  useLayoutEffect(() => {
    const activation = activationRef.current;
    activation.active = active;
    activation.epoch += 1;
    if (!active) {
      setConfirmConfig(null);
      setSyncingLatest(false);
    }
    return () => {
      activation.active = false;
      activation.epoch += 1;
    };
  }, [active]);

  const isCurrentActivation = (epoch: number) =>
    activationRef.current.active && activationRef.current.epoch === epoch;

  useEffect(() => {
    setTempUrl(webdavUrl);
    setTempUsername(webdavUsername);
    setTempRemoteDir(webdavRemoteDir);
    setTempRetentionDays(webdavRetentionDays);
    setTempAutoBackupEnabled(webdavAutoBackupEnabled);
  }, [
    webdavUrl,
    webdavUsername,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavAutoBackupEnabled,
  ]);

  const busy =
    testing ||
    uploading ||
    syncingLatest ||
    remoteLoading ||
    restoringFile !== null ||
    deletingFile !== null;

  const hasSavedConfig = Boolean(webdavUrl && webdavUsername && webdavPassword);

  const lastUploadText = useMemo(() => {
    const time = formatRemoteTime(webdavLastUploadAt);
    return webdavLastUploadFilename
      ? `${time} (${webdavLastUploadFilename})`
      : "尚未同步";
  }, [webdavLastUploadAt, webdavLastUploadFilename]);

  const lastDownloadText = useMemo(() => {
    const time = formatRemoteTime(webdavLastDownloadAt);
    return webdavLastDownloadFilename
      ? `${time} (${webdavLastDownloadFilename})`
      : "尚未同步";
  }, [webdavLastDownloadAt, webdavLastDownloadFilename]);
  return {
    active,
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
    onRestartGuide,
    onResetAndImport,
    selectedCount,
    totalCount,
    notebooks,
    pages,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavAutoBackupEnabled,
    webdavLastUploadAt,
    webdavLastUploadFilename,
    webdavLastDownloadAt,
    webdavLastDownloadFilename,
    updateWebdavSettings,
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
    setTesting,
    uploading,
    setUploading,
    syncingLatest,
    setSyncingLatest,
    remoteLoading,
    setRemoteLoading,
    isRemoteListOpen,
    setIsRemoteListOpen,
    showAllRemote,
    setShowAllRemote,
    remoteFiles,
    setRemoteFiles,
    restoringFile,
    setRestoringFile,
    deletingFile,
    setDeletingFile,
    confirmConfig,
    setConfirmConfig,
    activationRef,
    isCurrentActivation,
    busy,
    hasSavedConfig,
    lastUploadText,
    lastDownloadText,
  };
}
