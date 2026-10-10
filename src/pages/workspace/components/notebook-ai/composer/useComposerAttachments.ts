import { useCallback, useState } from "react";
import { toast } from "@/components/ui/sonner";
import {
  extractClipboardImageFiles,
  isImageUploadFile,
  resolveImageMimeForUpload,
} from "@/components/editor/utils/pasteClipboardImage";
import type { ComposerProps } from "./types";
import type { ComposerSurfaceState } from "./useComposerSurface";
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
export function useComposerAttachments(
  { disabled, isStreaming }: ComposerProps,
  { inputRef }: ComposerSurfaceState,
) {
  const [dropActive, setDropActive] = useState(false);
  const addImageFiles = useCallback((selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    const accepted = selectedFiles
      .filter(isImageUploadFile)
      .filter((file) =>
        SUPPORTED_IMAGE_MEDIA_TYPES.has(resolveImageMimeForUpload(file)),
      )
      .map((file) => {
        const mediaType = resolveImageMimeForUpload(file);
        return file.type === mediaType
          ? file
          : new File([file], file.name, {
              type: mediaType,
              lastModified: file.lastModified,
            });
      });

    if (accepted.length === 0) {
      toast.error("请选择 PNG、JPEG、WebP 或 GIF 图片。");
      return;
    }

    inputRef.current?.insertImages(accepted);
  }, []);

  const handleImageInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = "";
      addImageFiles(selectedFiles);
    },
    [addImageFiles],
  );

  /** 粘贴图片 → 插入到光标处（Mac 截图常只有 items，files 为空） */
  const handleDockPaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (disabled || isStreaming) return;
      const imageFiles = extractClipboardImageFiles(event.clipboardData);
      if (imageFiles.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      addImageFiles(imageFiles);
    },
    [addImageFiles, disabled, isStreaming],
  );

  /** 拖入图片：允许 drop + 轻量高亮 */
  const handleDockDragOver = useCallback(
    (event: React.DragEvent) => {
      if (disabled || isStreaming) return;
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (
        !types.includes("Files") &&
        !types.some((t) => t.startsWith("image/"))
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    },
    [disabled, isStreaming],
  );

  const handleDockDragLeave = useCallback((event: React.DragEvent) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setDropActive(false);
  }, []);

  const handleDockDrop = useCallback(
    (event: React.DragEvent) => {
      setDropActive(false);
      if (disabled || isStreaming) return;
      const imageFiles = extractClipboardImageFiles(event.dataTransfer);
      if (imageFiles.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      addImageFiles(imageFiles);
    },
    [addImageFiles, disabled, isStreaming],
  );

  return {
    dropActive,
    handleImageInput,
    handleDockPaste,
    handleDockDragOver,
    handleDockDragLeave,
    handleDockDrop,
  };
}
