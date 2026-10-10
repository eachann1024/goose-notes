import type { PreviewContent } from "@/lib/preview/previewAction";
import type { ArtifactInsertResult } from "./insertArtifact";
export interface ArtifactActionsProps {
  /** 复制源码（Mermaid DSL / SVG 文本等） */
  copySource?: string;
  /** 下载文件内容（SVG 文本等）；与 onDownloadImage 二选一优先图片 */
  downloadSource?: string;
  filename?: string;
  mimeType?: string;
  /** 复制渲染图为 PNG（返回 data URL 或 Blob） */
  onCopyImage?: () => Promise<string | Blob>;
  /** 下载渲染图为 PNG */
  onDownloadImage?: () => Promise<Blob>;
  downloadImageFilename?: string;
  /** 生成预览内容；左键全屏、右键系统。优先于 onPreviewImage */
  onPreview?: () => Promise<PreviewContent>;
  /** 生成预览图（data URL 或 Blob）；没有 onPreview 时作为图片预览 */
  onPreviewImage?: () => Promise<string | Blob>;
  previewFilename?: string;
  onInsert?: () => Promise<ArtifactInsertResult> | ArtifactInsertResult;
}
