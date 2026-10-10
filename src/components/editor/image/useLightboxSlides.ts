import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorPlatform } from "@/components/editor/platform/context";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { getImageElements, resolveImageSrc } from "./imageUtils";
import type { ImageLightboxProps, SlideInfo } from "./lightboxTypes";

export function useLightboxSlides(
  editorContainerRef: ImageLightboxProps["editorContainerRef"],
) {
  const platform = useEditorPlatform();
  const { getActivePageLocalFilePath } = useEditorPageContext();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const resolvedUrlsRef = useRef<Map<string, string>>(new Map());
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    });
    objectUrlsRef.current.clear();
    resolvedUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      cleanupObjectUrls();
    };
  }, [cleanupObjectUrls]);
  const buildSlides = useCallback(
    async (container: HTMLElement): Promise<SlideInfo[]> => {
      const images = getImageElements(container);
      const slides: SlideInfo[] = [];

      for (const img of images) {
        const src = img.src || img.getAttribute("src") || "";
        const alt = img.alt || img.getAttribute("alt") || "";

        if (!src) continue;

        let resolved = resolvedUrlsRef.current.get(src);
        if (!resolved) {
          resolved = await resolveImageSrc(
            src,
            platform,
            getActivePageLocalFilePath(),
          );
          resolvedUrlsRef.current.set(src, resolved);
          if (resolved.startsWith("blob:")) {
            objectUrlsRef.current.add(resolved);
          }
        }

        slides.push({ src: resolved, alt });
      }

      return slides;
    },
    [platform, getActivePageLocalFilePath],
  );

  const openLightboxAtImage = useCallback(
    async (img: HTMLImageElement) => {
      const container = editorContainerRef.current;
      if (!container) return;

      const images = getImageElements(container);
      const clickedIndex = images.indexOf(img);
      if (clickedIndex < 0) return;

      const newSlides = await buildSlides(container);
      if (newSlides.length === 0) return;

      setSlides(newSlides);
      setIndex(clickedIndex);
      setOpen(true);
    },
    [editorContainerRef, buildSlides],
  );
  const handleImageDoubleClick = useCallback(
    async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const img = target.closest<HTMLImageElement>(
        '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img',
      );
      if (!img) return;

      event.preventDefault();
      event.stopPropagation();

      await openLightboxAtImage(img);
    },
    [openLightboxAtImage],
  );

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    container.addEventListener("dblclick", handleImageDoubleClick);
    return () => {
      container.removeEventListener("dblclick", handleImageDoubleClick);
    };
  }, [editorContainerRef, handleImageDoubleClick]);

  return {
    open,
    setOpen,
    index,
    setIndex,
    slides,
    currentSlide: slides[index],
    openLightboxAtImage,
  };
}
