export const VIDEO_OUTPUT_MIME = "video/mp4";

export interface VideoTranscodeProgress {
  percent?: number;
  size?: string;
  speed?: string;
}

export function isVideoUploadFile(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|m4v|mov|webm|avi|mkv|flv|wmv)$/i.test(file.name)
  );
}

export async function transcodeVideo(
  input: File,
  onProgress?: (progress: VideoTranscodeProgress) => void,
): Promise<Blob> {
  // Electron 版不内置 FFmpeg；保留原始视频，避免不可用宿主 API 的静默失败。
  onProgress?.({ percent: 100 });
  return input;
}
