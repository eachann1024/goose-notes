import { HostAdapter } from "@/lib/host/adapter";
import { hostRuntime } from "@/lib/host";
import { fs } from "@/lib/electron-platform/fs";
import {
  currentLocalPagePath,
  pageDirectory,
} from "@/lib/currentLocalPagePath";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import { resolveToAbsolute } from "@/lib/imageStorage/strategies/file-system";
import {
  transcodeVideo,
  VIDEO_OUTPUT_MIME,
  type VideoTranscodeProgress,
} from "@/lib/videoProcessor";

export const MAX_VIDEO_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const ELECTRON_MAX_VIDEO_ATTACHMENT_SIZE = 50 * 1024 * 1024;

/** 视频附件上限：Electron 10MB，Electron 桌面端 50MB。 */
function getMaxVideoAttachmentSize(): number {
  return hostRuntime.kind === "electron"
    ? ELECTRON_MAX_VIDEO_ATTACHMENT_SIZE
    : MAX_VIDEO_ATTACHMENT_SIZE;
}
const VIDEO_ATTACHMENT_PREFIX = "att-video:";
const VIDEO_ID_PREFIX = "goose-video/";

function attachmentId(ref: string): string {
  return ref.replace(VIDEO_ATTACHMENT_PREFIX, "");
}

export const videoStorage = {
  async save(
    file: File,
    onProgress?: (progress: VideoTranscodeProgress) => void,
  ): Promise<string> {
    const video = await transcodeVideo(file, onProgress);
    const localPagePath = await currentLocalPagePath();

    // Electron 仅本地文件夹模式：无仓库时禁止视频写入内置 db
    if (!localPagePath && hostRuntime.kind === "electron") {
      throw new Error("请先打开文件夹仓库，再插入视频");
    }

    if (localPagePath) {
      if (!fs.isAvailable())
        throw new Error("本地文件服务未就绪，无法保存视频");
      const assetsDirectory = `${pageDirectory(localPagePath)}/assets`;
      if (
        !(await fs.existsAsync(assetsDirectory)) &&
        !(await fs.mkdir(assetsDirectory))
      ) {
        throw new Error("视频资源目录创建失败");
      }
      // 转码产物固定 mp4；无 FFmpeg 宿主透传原文件时保留原扩展名，避免 mislabel。
      const passthroughExt =
        video.type && video.type !== VIDEO_OUTPUT_MIME
          ? file.name.split(".").pop()?.toLowerCase() || "mp4"
          : "mp4";
      const filename = `vid_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${passthroughExt}`;
      const saved = await fs.writeFileAsync(
        `${assetsDirectory}/${filename}`,
        (await blobToBase64(video)).split(",")[1],
        "base64",
      );
      if (!saved) throw new Error("压缩后的视频保存失败");
      return `./assets/${filename}`;
    }

    const maxSize = getMaxVideoAttachmentSize();
    if (video.size > maxSize) {
      throw new Error(
        `视频压缩后仍超过 ${Math.floor(maxSize / (1024 * 1024))}MB 上限，无法保存为附件`,
      );
    }
    const id = `${VIDEO_ID_PREFIX}${Date.now()}_${crypto.randomUUID().slice(0, 8)}.mp4`;
    const result = await HostAdapter.db.postAttachment(
      id,
      new Uint8Array(await video.arrayBuffer()),
      VIDEO_OUTPUT_MIME,
    );
    if (!result?.ok) {
      const detail = typeof result?.error === "string" ? result.error : "";
      if (detail.includes("上限")) throw new Error(detail);
      throw new Error(
        hostRuntime.kind === "electron"
          ? detail || "视频写入磁盘失败"
          : "视频附件保存失败，请检查存储空间",
      );
    }
    return `${VIDEO_ATTACHMENT_PREFIX}${id}`;
  },

  async load(
    ref: string,
    pageLocalFilePath?: string | null,
  ): Promise<Blob | null> {
    if (ref.startsWith(VIDEO_ATTACHMENT_PREFIX)) {
      const id = attachmentId(ref);
      const data = await HostAdapter.db.getAttachment(id);
      return data
        ? new Blob([data.slice()], {
            type:
              (await HostAdapter.db.getAttachmentType(id)) || VIDEO_OUTPUT_MIME,
          })
        : null;
    }
    if (!pageLocalFilePath) return null;
    const path = resolveToAbsolute(pageDirectory(pageLocalFilePath), ref);
    const gfs = typeof window !== "undefined" ? window.gooseFs : undefined;
    // 原生壳（Electron）无同步 fs，优先异步二进制桥。
    const base64 = gfs?.readFileBase64Async
      ? await gfs.readFileBase64Async(path)
      : (gfs?.readFileBase64?.(path) ?? null);
    if (!base64) return null;
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      data[index] = binary.charCodeAt(index);
    return new Blob([data], { type: VIDEO_OUTPUT_MIME });
  },

  canHandle(ref: string): boolean {
    return (
      ref.startsWith(VIDEO_ATTACHMENT_PREFIX) ||
      /\.(mp4|m4v|mov|webm)$/i.test(ref)
    );
  },
};
