/**
 * 输入框内联图片：注册表、hover 预览、插入/移除、卸载释放。
 * 被 AiComposerInput 在 Skill 预热 effect 之后调用。
 * 依赖 composerImageChip、imageDedup、composerTokens、skill 光标锚点。
 */
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PreviewContent } from "@/lib/preview/previewAction";
import type { AiImageAttachmentAttrs } from "./referenceLookup";
import {
  calculateImageSha256,
  type ImageDedupTracker,
} from "./imageDedup";
import {
  createImageChipElement,
  createImageId,
  getPreviewableImageChip,
  IMAGE_PREVIEW_HIDE_MS,
  parseImageChipAttrs,
  positionImagePreview,
  type ComposerImageRegistry,
} from "./composerImageChip";
import { readTokensFromDom } from "./composerTokens";
import {
  ensureComposerCaretAnchors,
  placeCaretAfterNode,
  pruneEmptyComposerTextNodes,
} from "./useSkillCommands";

export function useComposerImages(options: {
  editorRef: RefObject<HTMLDivElement | null>;
  imageRegistryRef: RefObject<ComposerImageRegistry>;
  imageDedupRef: RefObject<ImageDedupTracker>;
  imagePreviewElRef: RefObject<HTMLDivElement | null>;
  imagePreviewHideTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  activePreviewImageIdRef: RefObject<string | null>;
  activePreviewChipRef: RefObject<HTMLElement | null>;
  onContentMutation: () => void;
  maxImageBytes?: number;
  maxImageCount?: number;
  onImageRejected?: (message: string) => void;
}) {
  const {
    editorRef,
    imageRegistryRef,
    imageDedupRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    onContentMutation,
    maxImageBytes,
    maxImageCount,
    onImageRejected,
  } = options;

  const [imagePreviewContent, setImagePreviewContent] =
    useState<PreviewContent | null>(null);

  const countImageTokens = useCallback((): number => {
    const el = editorRef.current;
    if (!el) return 0;
    return readTokensFromDom(el).filter((token) => token.type === "image")
      .length;
  }, [editorRef]);

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
    (chip: HTMLElement, imageId: string, previewUrl: string, fileName: string) => {
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

  const releaseAllImages = useCallback(() => {
    hideImagePreview();
    imageRegistryRef.current.forEach((entry) =>
      URL.revokeObjectURL(entry.previewUrl),
    );
    imageRegistryRef.current.clear();
    imageDedupRef.current.clear();
  }, [hideImagePreview, imageDedupRef, imageRegistryRef]);

  const removeImageChip = useCallback(
    (imageId: string) => {
      if (activePreviewImageIdRef.current === imageId) {
        hideImagePreview();
      }
      const el = editorRef.current;
      const chip = el
        ?.querySelector<HTMLElement>(`[data-ai-image-remove="${imageId}"]`)
        ?.closest("[data-ai-image-attrs]");
      const entry = imageRegistryRef.current.get(imageId);
      if (entry) {
        URL.revokeObjectURL(entry.previewUrl);
        imageRegistryRef.current.delete(imageId);
      }
      imageDedupRef.current.release(imageId);
      if (chip?.parentNode) {
        chip.parentNode.removeChild(chip);
        onContentMutation();
      }
    },
    [
      activePreviewImageIdRef,
      editorRef,
      hideImagePreview,
      imageDedupRef,
      imageRegistryRef,
      onContentMutation,
    ],
  );

  const insertImages = useCallback(
    (files: File[]) => {
      const el = editorRef.current;
      if (!el || files.length === 0) return;

      const currentCount = countImageTokens();
      const capacity =
        maxImageCount !== undefined
          ? Math.max(0, maxImageCount - currentCount)
          : files.length;

      if (capacity <= 0) {
        onImageRejected?.(`每次最多添加 ${maxImageCount} 张图片。`);
        return;
      }

      const accepted: { file: File; attrs: AiImageAttachmentAttrs }[] = [];
      let oversized = 0;
      let duplicates = 0;
      for (const file of files) {
        if (accepted.length >= capacity) break;
        if (maxImageBytes !== undefined && file.size > maxImageBytes) {
          oversized += 1;
          continue;
        }

        const attrs: AiImageAttachmentAttrs = {
          imageId: createImageId(),
          fileName: file.name || "图片",
          mediaType: file.type || "image/*",
          size: file.size,
        };
        if (!imageDedupRef.current.claim(attrs.imageId, file)) {
          duplicates += 1;
          continue;
        }
        accepted.push({ file, attrs });
      }

      if (oversized > 0) {
        onImageRejected?.(
          `有 ${oversized} 张图片超过 ${Math.round(maxImageBytes! / 1024 / 1024)}MB，未添加。`,
        );
      }
      if (duplicates > 0) {
        onImageRejected?.(`有 ${duplicates} 张重复图片，未添加。`);
      }
      if (accepted.length === 0) return;
      if (accepted.length < files.length - oversized - duplicates) {
        onImageRejected?.(`已添加 ${accepted.length} 张图片。`);
      }

      // 确保 selection 落在编辑器内（否则追加到末尾）
      const selection = window.getSelection();
      const inside =
        selection &&
        selection.rangeCount > 0 &&
        (el === selection.anchorNode || el.contains(selection.anchorNode));
      if (!inside) {
        el.focus();
        const endRange = document.createRange();
        endRange.selectNodeContents(el);
        endRange.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(endRange);
      }

      const range = window.getSelection()!.getRangeAt(0);
      range.deleteContents();

      // Spacing via CSS margin on .ai-composer-chip; no spacer text nodes.
      const frag = document.createDocumentFragment();
      let lastChip: HTMLSpanElement | null = null;
      for (const { file, attrs } of accepted) {
        imageRegistryRef.current.set(attrs.imageId, {
          file,
          previewUrl: URL.createObjectURL(file),
        });
        lastChip = createImageChipElement(attrs, imageRegistryRef.current);
        frag.appendChild(lastChip);
      }
      range.insertNode(frag);
      pruneEmptyComposerTextNodes(el);
      ensureComposerCaretAnchors(el);

      if (lastChip) {
        // 落在 ZWSP/文本节点上，旧 Chromium 才能画出 caret
        placeCaretAfterNode(lastChip);
      }

      onContentMutation();

      for (const { file, attrs } of accepted) {
        void calculateImageSha256(file).then((contentHash) => {
          if (!contentHash || !imageDedupRef.current.has(attrs.imageId)) return;
          const duplicateId = imageDedupRef.current.resolveContentHash(
            attrs.imageId,
            contentHash,
          );
          if (!duplicateId) return;
          removeImageChip(duplicateId);
          onImageRejected?.("检测到重复图片，已移除后加入的图片。");
        });
      }
    },
    [
      countImageTokens,
      editorRef,
      imageDedupRef,
      imageRegistryRef,
      maxImageBytes,
      maxImageCount,
      onContentMutation,
      onImageRejected,
      removeImageChip,
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

  useEffect(() => {
    const registry = imageRegistryRef.current;
    const dedup = imageDedupRef.current;
    return () => {
      if (imagePreviewHideTimerRef.current != null) {
        clearTimeout(imagePreviewHideTimerRef.current);
        imagePreviewHideTimerRef.current = null;
      }
      const preview = imagePreviewElRef.current;
      if (preview?.isConnected) {
        preview.remove();
      }
      imagePreviewElRef.current = null;
      activePreviewImageIdRef.current = null;
      activePreviewChipRef.current = null;
      registry.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      registry.clear();
      dedup.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    imagePreviewContent,
    setImagePreviewContent,
    hideImagePreview,
    cancelImagePreviewHide,
    releaseAllImages,
    removeImageChip,
    insertImages,
    handleImagePreviewOver,
    handleImagePreviewOut,
  };
}
