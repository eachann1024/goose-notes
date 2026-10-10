import { createClient } from "webdav";
import { useSettings } from "@/stores/settings";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { generateExportZip } from "@/lib/export";

export interface WebdavBackupFile {
  filename: string;
  basename: string;
  size: number;
  lastmod: string;
}

import {
  normalizeBaseUrl,
  normalizeRemoteDir,
  isBackupFileName,
  formatWebdavError,
  ensureRemoteDir,
} from "./webdavValidation";
export {
  normalizeBaseUrl,
  normalizeRemoteDir,
  isBackupFileName,
} from "./webdavValidation";

export async function testWebdavConnection(
  url: string,
  username: string,
  passwordInput: string,
  remoteDir: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const cleanUrl = normalizeBaseUrl(url);
    const cleanDir = normalizeRemoteDir(remoteDir);
    const client = createClient(cleanUrl, {
      username,
      password: passwordInput,
    });

    await client.getDirectoryContents("/");
    await ensureRemoteDir(client, cleanDir);
    await client.getDirectoryContents(cleanDir);

    return { ok: true, message: "连接成功" };
  } catch (err) {
    return { ok: false, message: formatWebdavError(err) };
  }
}

export async function listWebdavBackups(
  url: string,
  username: string,
  passwordInput: string,
  remoteDir: string,
): Promise<WebdavBackupFile[]> {
  const cleanUrl = normalizeBaseUrl(url);
  const cleanDir = normalizeRemoteDir(remoteDir);
  const client = createClient(cleanUrl, { username, password: passwordInput });

  const exists = await client.exists(cleanDir);
  if (!exists) return [];

  const items = await client.getDirectoryContents(cleanDir);
  if (!Array.isArray(items)) return [];

  const files = items
    .filter((item) => item.type === "file" && isBackupFileName(item.basename))
    .map((item) => {
      let decodedBasename = item.basename;
      try {
        decodedBasename = decodeURIComponent(item.basename);
      } catch (e) {
        console.warn("解码文件名失败", item.basename, e);
      }
      return {
        filename: item.filename,
        basename: decodedBasename,
        size: item.size,
        lastmod: item.lastmod || new Date().toISOString(),
      };
    });

  return files.sort((a, b) => {
    const timeA = new Date(a.lastmod).getTime();
    const timeB = new Date(b.lastmod).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.basename.localeCompare(a.basename);
  });
}

export async function uploadWebdavBackup(
  url: string,
  username: string,
  passwordInput: string,
  remoteDir: string,
  retentionDays: number,
  zipBlob: Blob,
  fileName: string,
): Promise<{ success: boolean; cleanedCount: number }> {
  if (!isBackupFileName(fileName)) {
    throw new Error("WebDAV 只允许操作鹅毛笔备份文件");
  }

  const cleanUrl = normalizeBaseUrl(url);
  const cleanDir = normalizeRemoteDir(remoteDir);
  const client = createClient(cleanUrl, { username, password: passwordInput });

  await ensureRemoteDir(client, cleanDir);

  const buffer = await zipBlob.arrayBuffer();
  await client.putFileContents(`${cleanDir}/${fileName}`, buffer);

  let cleanedCount = 0;
  try {
    const list = await listWebdavBackups(
      cleanUrl,
      username,
      passwordInput,
      cleanDir,
    );
    const cutoff =
      Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;

    for (const file of list) {
      const fileTime = new Date(file.lastmod).getTime();
      if (fileTime < cutoff) {
        try {
          await client.deleteFile(`${cleanDir}/${file.basename}`);
          cleanedCount++;
        } catch (delErr: any) {
          if (delErr.status === 404 || delErr.response?.status === 404) {
            continue;
          }
          console.error("删除过期备份文件出错", file.basename, delErr);
        }
      }
    }
  } catch (cleanErr) {
    console.warn("清理过期备份失败", cleanErr);
  }

  return { success: true, cleanedCount };
}

export async function downloadWebdavBackup(
  url: string,
  username: string,
  passwordInput: string,
  remoteDir: string,
  fileName: string,
): Promise<Blob> {
  if (!isBackupFileName(fileName)) {
    throw new Error("WebDAV 只允许操作鹅毛笔备份文件");
  }

  const cleanUrl = normalizeBaseUrl(url);
  const cleanDir = normalizeRemoteDir(remoteDir);
  const client = createClient(cleanUrl, { username, password: passwordInput });

  const fileData = (await client.getFileContents(`${cleanDir}/${fileName}`, {
    format: "binary",
  })) as ArrayBuffer;
  return new Blob([fileData], { type: "application/zip" });
}

export async function deleteWebdavBackup(
  url: string,
  username: string,
  passwordInput: string,
  remoteDir: string,
  fileName: string,
): Promise<void> {
  if (!isBackupFileName(fileName)) {
    throw new Error("WebDAV 只允许操作鹅毛笔备份文件");
  }

  const cleanUrl = normalizeBaseUrl(url);
  const cleanDir = normalizeRemoteDir(remoteDir);
  const client = createClient(cleanUrl, { username, password: passwordInput });
  try {
    await client.deleteFile(`${cleanDir}/${fileName}`);
  } catch (err: any) {
    if (err.status === 404 || err.response?.status === 404) {
      return;
    }
    throw err;
  }
}

let autoBackupInFlight = false;

export async function triggerAutoWebdavBackup(): Promise<void> {
  if (autoBackupInFlight) return;
  const settings = useSettings.getState();
  const {
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavRemoteDir,
    webdavRetentionDays,
    webdavAutoBackupEnabled,
    webdavLastUploadAt,
    updateWebdavSettings,
  } = settings;

  if (!webdavAutoBackupEnabled) return;
  if (!webdavUrl || !webdavUsername || !webdavPassword || !webdavRemoteDir)
    return;

  const now = Date.now();
  if (webdavLastUploadAt) {
    const lastTime = new Date(webdavLastUploadAt).getTime();
    if (now - lastTime < 24 * 60 * 60 * 1000) {
      return;
    }
  }

  autoBackupInFlight = true;
  try {
    const notebooksStore = useNotebooks.getState();
    const pagesStore = usePages.getState();
    const notebookIds = Object.values(notebooksStore.notebooks)
      .filter((notebook) => notebook.source !== "local-folder")
      .map((n) => n.id);
    if (notebookIds.length === 0) return;

    const zipBlob = await generateExportZip(
      { format: "md", notebookIds },
      notebooksStore.notebooks,
      Object.values(pagesStore.pages),
    );

    const date = new Date(now);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fileName = `goose-note-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.zip`;

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
        webdavLastUploadAt: date.toISOString(),
        webdavLastUploadFilename: fileName,
      });
      console.log(
        `[AutoBackup] WebDAV auto backup completed: ${fileName}, cleaned: ${result.cleanedCount}`,
      );
    }
  } catch (err) {
    console.warn("[AutoBackup] WebDAV auto backup failed silently:", err);
  } finally {
    autoBackupInFlight = false;
  }
}
