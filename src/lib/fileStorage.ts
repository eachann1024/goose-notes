import { UToolsAdapter } from "@/lib/utools";
import { hostRuntime } from "@/lib/host";
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

    // Electron 仅本地文件夹模式：无仓库（当前页非本地文件）时禁止附件写入内置 db
    if (hostRuntime.kind === "electron") {
      const { usePages } = await import("@/stores/usePages");
      const { activePageId, pages } = usePages.getState();
      const activePage = activePageId ? pages[activePageId] : null;
      if (!activePage?.localFilePath) {
        throw new Error("请先打开文件夹仓库，再插入附件");
      }
    }

    const attachmentId = `${FILE_ID_PREFIX}${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const mimeType = file.type || DEFAULT_MIME_TYPE;
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

  async load(storageRef: string): Promise<Blob | null> {
    const attachmentId = getAttachmentId(storageRef);
    const data = await UToolsAdapter.db.getAttachment(attachmentId);
    if (!data) return null;

    const mimeType =
      (await UToolsAdapter.db.getAttachmentType(attachmentId)) || DEFAULT_MIME_TYPE;
    return new Blob([data.slice()], {
      type: mimeType,
    });
  },

  async open(
    storageRef: string,
    meta: { fileName: string; size?: number },
  ): Promise<{ ok: boolean; error?: string }> {
    const { openResourceExternally } = await import(
      "@/components/editor/utils/openResourceExternally"
    );
    const { editorPlatform } = await import("@/lib/editor-platform/resolve");
    return openResourceExternally({
      source: storageRef,
      fileName: meta.fileName,
      platform: editorPlatform,
      loadInternalResource: (ref) => fileStorage.load(ref),
    });
  },

  async delete(storageRef: string): Promise<void> {
    const attachmentId = getAttachmentId(storageRef);
    UToolsAdapter.db.remove(attachmentId);
  },
};
