/**
 * Electron 桌面端的附件磁盘存储。
 *
 * 布局：userData/attachments/{id} 为二进制本体，{id}.meta 为 JSON { type }。
 * 上限 50MB。首次使用时把 localStorage 里 goose-note:web-att:* 的 base64 附件
 * 搬到磁盘后删除旧 key。
 *
 * 仅被 src/lib/host/runtime.electron.ts 使用（electron 构建专属）。
 */

import type { HostPutResult } from "@/lib/host/types";
import { getGooseDesktop } from "./runtime";

export const ELECTRON_MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const WEB_ATT_STORAGE_PREFIX = "goose-note:web-att:";
const ATTACHMENTS_DIR = "attachments";
const META_SUFFIX = ".meta";

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const attachmentPaths = async (
  id: string,
): Promise<{ dataPath: string; metaPath: string; parentDir: string }> => {
  const api = getGooseDesktop();
  if (!api) throw new Error("gooseDesktop 不可用");
  const base = await api.getUserDataPath();
  const segments = [ATTACHMENTS_DIR, ...id.split("/").filter(Boolean)];
  const dataPath = await api.joinPath(base, ...segments);
  const parentDir = await api.joinPath(base, ...segments.slice(0, -1));
  return { dataPath, metaPath: `${dataPath}${META_SUFFIX}`, parentDir };
};

let migratePromise: Promise<void> | null = null;

/** 把 localStorage 旧附件迁到磁盘（幂等，只跑一次）。 */
export const migrateLegacyAttachments = (): Promise<void> => {
  if (migratePromise) return migratePromise;
  migratePromise = (async () => {
    if (typeof window === "undefined") return;
    const api = getGooseDesktop();
    if (!api) return;
    let keys: string[] = [];
    try {
      keys = Object.keys(window.localStorage).filter((key) =>
        key.startsWith(WEB_ATT_STORAGE_PREFIX),
      );
    } catch {
      return;
    }
    if (keys.length === 0) return;
    for (const key of keys) {
      const id = key.slice(WEB_ATT_STORAGE_PREFIX.length);
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { type?: unknown; data?: unknown };
        if (typeof parsed.type !== "string" || typeof parsed.data !== "string") {
          continue;
        }
        const { dataPath, metaPath, parentDir } = await attachmentPaths(id);
        await api.fsMkdir(parentDir);
        await api.fsWrite(dataPath, base64ToBytes(parsed.data));
        await api.fsWriteText(metaPath, JSON.stringify({ type: parsed.type }));
        window.localStorage.removeItem(key);
      } catch (err) {
        console.warn("[electron-attachments] 迁移失败", id, err);
      }
    }
  })().catch((err) => {
    console.warn("[electron-attachments] 迁移异常", err);
  });
  return migratePromise;
};

export const postAttachment = async (
  id: string,
  data: Uint8Array,
  type: string,
): Promise<HostPutResult> => {
  if (data.byteLength > ELECTRON_MAX_ATTACHMENT_SIZE) {
    return {
      id,
      ok: false,
      error: `附件超过 50MB 上限（实际 ${(data.byteLength / (1024 * 1024)).toFixed(1)}MB）`,
    };
  }
  try {
    await migrateLegacyAttachments();
    const api = getGooseDesktop();
    if (!api) return { id, ok: false, error: "gooseDesktop 不可用" };
    const { dataPath, metaPath, parentDir } = await attachmentPaths(id);
    await api.fsMkdir(parentDir);
    await api.fsWrite(dataPath, data);
    await api.fsWriteText(metaPath, JSON.stringify({ type }));
    return { id, ok: true };
  } catch (error) {
    return { id, ok: false, error: `附件写入磁盘失败: ${toErrorMessage(error)}` };
  }
};

export const getAttachment = async (id: string): Promise<Uint8Array | null> => {
  try {
    await migrateLegacyAttachments();
    const api = getGooseDesktop();
    if (!api) return null;
    const { dataPath } = await attachmentPaths(id);
    if (!(await api.fsExists(dataPath))) return null;
    return await api.fsRead(dataPath);
  } catch {
    return null;
  }
};

export const getAttachmentType = async (id: string): Promise<string | null> => {
  try {
    await migrateLegacyAttachments();
    const api = getGooseDesktop();
    if (!api) return null;
    const { metaPath } = await attachmentPaths(id);
    if (!(await api.fsExists(metaPath))) return null;
    const raw = await api.fsReadText(metaPath);
    const parsed = JSON.parse(raw) as { type?: unknown };
    return typeof parsed.type === "string" ? parsed.type : null;
  } catch {
    return null;
  }
};

export const removeAttachment = async (id: string): Promise<void> => {
  try {
    const api = getGooseDesktop();
    if (!api) return;
    const { dataPath, metaPath, parentDir } = await attachmentPaths(id);
    if (await api.fsExists(dataPath)) await api.fsRemove(dataPath);
    if (await api.fsExists(metaPath)) await api.fsRemove(metaPath);
    if (!parentDir.endsWith(`/${ATTACHMENTS_DIR}`) && !parentDir.endsWith(`\\${ATTACHMENTS_DIR}`)) {
      try {
        const rest = await api.fsReadDir(parentDir);
        if (rest.length === 0) await api.fsRemove(parentDir);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
};
