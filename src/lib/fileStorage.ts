import { UToolsAdapter } from "@/lib/utools";
import type { FileAttachmentAttrs } from "@/types";

export const MAX_FILE_ATTACHMENT_SIZE = 10 * 1024 * 1024;
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

    if (file.size > MAX_FILE_ATTACHMENT_SIZE) {
      throw new Error("文件不能超过 10MB");
    }

    const attachmentId = `${FILE_ID_PREFIX}${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const mimeType = file.type || DEFAULT_MIME_TYPE;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = UToolsAdapter.db.postAttachment(attachmentId, buffer, mimeType);

    if (!result || result.ok === false) {
      throw new Error("附件上传失败，请稍后重试");
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
    const data = UToolsAdapter.db.getAttachment(attachmentId);
    if (!data) return null;

    const mimeType = UToolsAdapter.db.getAttachmentType(attachmentId) || DEFAULT_MIME_TYPE;
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
    const { utoolsEditorPlatform } = await import("@/lib/editor-platform/utools");
    return openResourceExternally({
      source: storageRef,
      fileName: meta.fileName,
      platform: utoolsEditorPlatform,
      loadInternalResource: (ref) => fileStorage.load(ref),
    });
  },

  async delete(storageRef: string): Promise<void> {
    const attachmentId = getAttachmentId(storageRef);
    UToolsAdapter.db.remove(attachmentId);
  },
};
