import { useCallback } from "react";
import {
  getPreviewableImageChip,
  IMAGE_PREVIEW_HIDE_MS,
  parseImageChipAttrs,
  positionImagePreview,
} from "./composerImageChip";
import type { ComposerImagesOptions } from "./composerImageTypes";

export function useComposerImagePreview(options: ComposerImagesOptions) {
  const {
    imageRegistryRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
  } = options;
  const cancelImagePreviewHide = useCallback(() => {
    if (imagePreviewHideTimerRef.current != null) {
      clearTimeout(imagePreviewHideTimerRef.current);
      imagePreviewHideTimerRef.current = null;
    }
  }, [imagePreviewHideTimerRef]);

  const hideImagePreview = useCallback(() => {
    cancelImagePreviewHide();
    activePreviewImageIdRef.current = null;
    activePreviewChipRef.current = null;
    const preview = imagePreviewElRef.current;
    if (!preview) return;
    preview.style.display = "none";
    preview.replaceChildren();
    preview.removeAttribute("aria-label");
    preview.setAttribute("aria-hidden", "true");
  }, [
    activePreviewChipRef,
    activePreviewImageIdRef,
    cancelImagePreviewHide,
    imagePreviewElRef,
  ]);

  const scheduleHideImagePreview = useCallback(() => {
    cancelImagePreviewHide();
    imagePreviewHideTimerRef.current = setTimeout(() => {
      imagePreviewHideTimerRef.current = null;
      hideImagePreview();
    }, IMAGE_PREVIEW_HIDE_MS);
  }, [cancelImagePreviewHide, hideImagePreview, imagePreviewHideTimerRef]);

  const showImagePreview = useCallback(
    (
      chip: HTMLElement,
      imageId: string,
      previewUrl: string,
      fileName: string,
    ) => {
      cancelImagePreviewHide();
      activePreviewImageIdRef.current = imageId;
      activePreviewChipRef.current = chip;

      const preview = imagePreviewElRef.current;
      // portal 在 editor mount 时创建；卸载后不再展示
      if (!preview?.isConnected) return;

      let img = preview.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        preview.appendChild(img);
      }
      if (img.src !== previewUrl) {
        img.src = previewUrl;
      }
      img.alt = fileName || "图片预览";
      preview.setAttribute("aria-label", `预览 ${fileName || "图片"}`);
      preview.removeAttribute("aria-hidden");
      preview.style.visibility = "hidden";
      preview.style.display = "block";

      const place = () => {
        if (activePreviewImageIdRef.current !== imageId) return;
        if (!activePreviewChipRef.current?.isConnected) {
          hideImagePreview();
          return;
        }
        positionImagePreview(preview, activePreviewChipRef.current);
        preview.style.visibility = "visible";
      };

      if (img.complete && img.naturalWidth > 0) {
        place();
      } else {
        img.onload = () => place();
        // 即便 onload 失败也先按当前尺寸放一次
        place();
      }
    },
    [
      activePreviewChipRef,
      activePreviewImageIdRef,
      cancelImagePreviewHide,
      hideImagePreview,
      imagePreviewElRef,
    ],
  );

  const handleImagePreviewOver = useCallback(
    (event: MouseEvent) => {
      const chip = getPreviewableImageChip(event.target);
      if (!chip || chip.dataset.aiImagePreviewable !== "true") {
        // 移入 remove 按钮：若当前在同 chip 上预览则关闭
        if (
          event.target instanceof Element &&
          event.target.closest("[data-ai-image-remove]")
        ) {
          scheduleHideImagePreview();
        }
        return;
      }
      const attrs = parseImageChipAttrs(chip);
      if (!attrs) return;
      const entry = imageRegistryRef.current.get(attrs.imageId);
      if (!entry?.previewUrl) return;
      if (activePreviewImageIdRef.current === attrs.imageId) {
        cancelImagePreviewHide();
        return;
      }
      showImagePreview(chip, attrs.imageId, entry.previewUrl, attrs.fileName);
    },
    [
      activePreviewImageIdRef,
      cancelImagePreviewHide,
      imageRegistryRef,
      scheduleHideImagePreview,
      showImagePreview,
    ],
  );

  const handleImagePreviewOut = useCallback(
    (event: MouseEvent) => {
      const related = event.relatedTarget;
      // 仍在同一 chip 内（除 remove 外）或进入预览浮层：保持
      if (related instanceof Node) {
        const preview = imagePreviewElRef.current;
        if (preview?.contains(related)) {
          cancelImagePreviewHide();
          return;
        }
        const fromChip = getPreviewableImageChip(event.target);
        const toChip = getPreviewableImageChip(related);
        if (fromChip && toChip && fromChip === toChip) {
          cancelImagePreviewHide();
          return;
        }
      }
      if (activePreviewImageIdRef.current) {
        scheduleHideImagePreview();
      }
    },
    [
      activePreviewImageIdRef,
      cancelImagePreviewHide,
      imagePreviewElRef,
      scheduleHideImagePreview,
    ],
  );

  return {
    hideImagePreview,
    cancelImagePreviewHide,
    handleImagePreviewOver,
    handleImagePreviewOut,
  };
}
