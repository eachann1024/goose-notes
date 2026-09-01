import { UToolsAdapter } from "@/lib/utools";
import { hostRuntime } from "@/lib/host";
import { fs } from "@/lib/utools/fs";
import {
  currentLocalNotebookRoot,
  currentLocalPagePath,
  isPathInsideNotebookRoot,
  pageDirectory,
} from "@/lib/currentLocalPagePath";
import {
  readLocalFileAsBlobAsync,
  resolveToAbsolute,
} from "@/lib/imageStorage/strategies/file-system";
import { isInternalAssetRef } from "@/lib/internalAssetRef";
import type { FileAttachmentAttrs } from "@/types";

export const MAX_FILE_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const ELECTRON_MAX_FILE_ATTACHMENT_SIZE = 50 * 1024 * 1024;

/** 附件上限：uTools 10MB，Electron 桌面端 50MB。 */
export function getMaxFileAttachmentSize(): number {
  return hostRuntime.kind === "electron" ? ELECTRON_MAX_FILE_ATTACHMENT_SIZE : MAX_FILE_ATTACHMENT_SIZE;
}
const FILE_ATTACHMENT_PREFIX = "att-file:";
const FILE_ID_PREFIX = "goose-file/";
const DEFAULT_MIME_TYPE = "application/octet-stream";

export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const normalized = trimmed.length > 0 ? trimmed : "attachment";
  // eslint-disable-next-line no-control-regex -- 有意匹配控制字符以清洗文件名
  return normalized.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 180);
}

function getAttachmentId(storageRef: string): string {
  return storageRef.replace(FILE_ATTACHMENT_PREFIX, "");
}

function resolveStorageExtension(fileName: string): string {
  const sanitized = sanitizeFileName(fileName);
  const dot = sanitized.lastIndexOf(".");
  if (dot > 0 && dot < sanitized.length - 1) {
    const ext = sanitized.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{1,12}$/.test(ext)) return ext;
  }
  return "bin";
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "--";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function getAttachmentBadgeLabel(fileName: string, mimeType: string): string {
  const extension = fileName.split(".").pop()?.trim();
  if (extension && extension !== fileName) {
    return extension.toUpperCase();
  }

  if (mimeType.includes("/")) {
    return mimeType.split("/")[1].toUpperCase();
  }

  return "FILE";
}

function isLocalFileStorageRef(storageRef: string): boolean {
  return !isInternalAssetRef(storageRef) && !/^[a-z][a-z0-9+.-]*:/i.test(storageRef);
}

export const fileStorage = {
  async save(file: File): Promise<FileAttachmentAttrs> {
    if (file.size === 0) {
      throw new Error("不能上传空文件");
    }

    const maxSize = getMaxFileAttachmentSize();
    if (file.size > maxSize) {
      throw new Error(
        `文件超过 ${Math.floor(maxSize / (1024 * 1024))}MB 上限（当前 ${formatAttachmentSize(file.size)}）`,
      );
    }

    const mimeType = file.type || DEFAULT_MIME_TYPE;
    const localPagePath = await currentLocalPagePath();

    // Electron 仅本地文件夹模式：无仓库（当前页非本地文件）时禁止附件写入内置 db
    if (!localPagePath && hostRuntime.kind === "electron") {
      throw new Error("请先打开文件夹仓库，再插入附件");
    }

    if (localPagePath) {
      if (!fs.isAvailable()) {
        throw new Error("本地文件服务未就绪，无法保存附件");
      }

      const assetsDirectory = `${pageDirectory(localPagePath)}/assets`;
      const ext = resolveStorageExtension(file.name);
      const filename = `file_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const fullPath = `${assetsDirectory}/${filename}`;
      const notebookRoot = await currentLocalNotebookRoot();
      if (notebookRoot && !isPathInsideNotebookRoot(fullPath, notebookRoot)) {
        throw new Error("附件保存路径超出笔记本目录");
      }

      if (
        !(await fs.existsAsync(assetsDirectory)) &&
        !(await fs.mkdir(assetsDirectory))
      ) {
        throw new Error("附件资源目录创建失败");
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      const saved = await fs.writeFileAsync(
        fullPath,
        uint8ArrayToBase64(buffer),
        "base64",
      );
      if (!saved) {
        throw new Error("附件写入本地文件夹失败");
      }

      return {
        storageRef: `./assets/${filename}`,
        fileName: sanitizeFileName(file.name),
        mimeType,
        size: file.size,
        uploadedAt: Date.now(),
      };
    }

    const attachmentId = `${FILE_ID_PREFIX}${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await UToolsAdapter.db.postAttachment(attachmentId, buffer, mimeType);

    if (!result || result.ok === false) {
      const detail = typeof result?.error === "string" ? result.error : "";
      if (detail.includes("上限")) {
        throw new Error(detail);
      }
      throw new Error(
        hostRuntime.kind === "electron"
          ? detail || "附件写入磁盘失败"
          : "附件上传失败，请检查存储空间",
      );
    }

    return {
      storageRef: `${FILE_ATTACHMENT_PREFIX}${attachmentId}`,
      fileName: sanitizeFileName(file.name),
      mimeType,
      size: file.size,
      uploadedAt: Date.now(),
    };
  },

  async load(
    storageRef: string,
    pageLocalFilePath?: string | null,
  ): Promise<Blob | null> {
    if (storageRef.startsWith(FILE_ATTACHMENT_PREFIX)) {
      const attachmentId = getAttachmentId(storageRef);
      const data = await UToolsAdapter.db.getAttachment(attachmentId);
      if (!data) return null;

      const mimeType =
        (await UToolsAdapter.db.getAttachmentType(attachmentId)) || DEFAULT_MIME_TYPE;
      return new Blob([data.slice()], {
        type: mimeType,
      });
    }

    if (!isLocalFileStorageRef(storageRef)) return null;

    const pagePath = pageLocalFilePath ?? (await currentLocalPagePath());
    if (!pagePath) return null;

    const fullPath = resolveToAbsolute(pageDirectory(pagePath), storageRef);
    return readLocalFileAsBlobAsync(fullPath);
  },

  async open(
    storageRef: string,
    meta: { fileName: string; size?: number },
  ): Promise<{ ok: boolean; error?: string }> {
    const { openResourceExternally } = await import(
      "@/components/editor/utils/openResourceExternally"
    );
    const { editorPlatform } = await import("@/lib/editor-platform/resolve");
    const pageLocalFilePath = await currentLocalPagePath();
    return openResourceExternally({
      source: storageRef,
      fileName: meta.fileName,
      pageLocalFilePath,
      platform: editorPlatform,
      loadInternalResource: (ref) => fileStorage.load(ref, pageLocalFilePath),
    });
  },

  async delete(
    storageRef: string,
    pageLocalFilePath?: string | null,
  ): Promise<void> {
    if (storageRef.startsWith(FILE_ATTACHMENT_PREFIX)) {
      const attachmentId = getAttachmentId(storageRef);
      UToolsAdapter.db.remove(attachmentId);
      return;
    }

    if (!isLocalFileStorageRef(storageRef) || !fs.isAvailable()) return;

    const pagePath = pageLocalFilePath ?? (await currentLocalPagePath());
    if (!pagePath) return;

    const fullPath = resolveToAbsolute(pageDirectory(pagePath), storageRef);
    const notebookRoot = await currentLocalNotebookRoot();
    if (notebookRoot && !isPathInsideNotebookRoot(fullPath, notebookRoot)) {
      return;
    }

    await fs.deleteFile(fullPath);
  },
};
