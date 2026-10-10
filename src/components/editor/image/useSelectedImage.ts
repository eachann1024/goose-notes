import { useCallback, useEffect, useRef, useState } from "react";
import {
  getImageElements,
  getImageBlockElement,
  getBlockIdFromImage,
  getImageSrc,
  getImageBlockIdByIndex,
  getImageAlignmentFromBlock,
  type ImageAlignment,
} from "./imageUtils";
import type { SelectedImageState } from "./ImageToolbar";
import type { ImageLightboxProps } from "./lightboxTypes";
import type { useLightboxActions } from "./useLightboxActions";

export function useSelectedImage(
  editor: ImageLightboxProps["editor"],
  editorContainerRef: ImageLightboxProps["editorContainerRef"],
  openLightboxAtImage: (img: HTMLImageElement) => Promise<void>,
  actions: ReturnType<typeof useLightboxActions>,
) {
  const { openImageInSystemViewer, downloadImage, copyImageToClipboard } =
    actions;
  const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(
    null,
  );
  const selectedImageRef = useRef<SelectedImageState | null>(null);
  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);
  const updateSelectedImageFromElement = useCallback(
    (img: HTMLImageElement) => {
      const container = editorContainerRef.current;
      if (!container) return;

      const imageIndex = getImageElements(container).indexOf(img);
      const blockId =
        getBlockIdFromImage(img, container) ||
        getImageBlockIdByIndex(editor.document as any[], imageIndex);
      const block = blockId ? editor.getBlock(blockId) : null;
      const blockElement = getImageBlockElement(img, container);
      const anchorElement = __GOOSE_EDITOR_COMPACT__
        ? (blockElement ?? img)
        : img;

      setSelectedImage({
        blockId,
        src:
          (block?.props as { url?: string } | undefined)?.url ||
          getImageSrc(img),
        alt: img.alt || img.getAttribute("alt") || "",
        index: imageIndex,
        rect: anchorElement.getBoundingClientRect(),
        alignment: getImageAlignmentFromBlock(block),
      });
    },
    [editor, editorContainerRef],
  );

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const img = target?.closest<HTMLImageElement>(
        '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img',
      );

      if (!img || !container.contains(img)) {
        if (!target?.closest("[data-goose-image-toolbar]")) {
          setSelectedImage(null);
        }
        return;
      }

      updateSelectedImageFromElement(img);
    };

    const handleReposition = () => {
      const current = selectedImageRef.current;
      if (!current) return;
      const images = getImageElements(container);
      const img = images[current.index];
      if (!img) {
        setSelectedImage(null);
        return;
      }
      updateSelectedImageFromElement(img);
    };

    container.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [editorContainerRef, updateSelectedImageFromElement]);
  const applyImageAlignment = useCallback(
    (alignment: ImageAlignment) => {
      if (!selectedImage?.blockId) return;
      const block = editor.getBlock(selectedImage.blockId);
      if (!block) return;

      editor.updateBlock(block, {
        props: { textAlignment: alignment },
      } as any);

      setSelectedImage((current) =>
        current ? { ...current, alignment } : current,
      );
    },
    [editor, selectedImage],
  );

  const handleSelectedImageZoom = useCallback(async () => {
    const container = editorContainerRef.current;
    if (!container || !selectedImage) return;
    const img = getImageElements(container)[selectedImage.index];
    if (!img) return;
    await openLightboxAtImage(img);
  }, [editorContainerRef, openLightboxAtImage, selectedImage]);

  const handleSelectedImageSystemPreview = useCallback(async () => {
    const container = editorContainerRef.current;
    if (!container || !selectedImage) return;
    const img = getImageElements(container)[selectedImage.index];
    if (!img) return;
    await openImageInSystemViewer(img);
  }, [editorContainerRef, openImageInSystemViewer, selectedImage]);

  const getSelectedImageRect = useCallback(() => {
    const container = editorContainerRef.current;
    const current = selectedImageRef.current;
    if (!container || !current) return null;
    return (
      getImageElements(container)[current.index]?.getBoundingClientRect() ??
      null
    );
  }, [editorContainerRef]);

  const handleSelectedImageDownload = useCallback(async () => {
    if (!selectedImage) return;
    await downloadImage(selectedImage.src);
  }, [downloadImage, selectedImage]);

  const handleSelectedImageCopy = useCallback(async () => {
    if (!selectedImage) return;
    await copyImageToClipboard(selectedImage.src);
  }, [copyImageToClipboard, selectedImage]);

  return {
    selectedImage,
    applyImageAlignment,
    handleSelectedImageZoom,
    handleSelectedImageSystemPreview,
    getSelectedImageRect,
    handleSelectedImageDownload,
    handleSelectedImageCopy,
  };
}
