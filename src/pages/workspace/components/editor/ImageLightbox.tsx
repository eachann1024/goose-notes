import { useCallback, useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Zoom } from "yet-another-react-lightbox/plugins";
import { Download, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { imageStorage } from "@/lib/imageStorage";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import { saveBlobAndReveal } from "@/lib/export";

interface ImageLightboxProps {
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface SlideInfo {
  src: string;
  alt?: string;
}

const isUToolsEnv = () =>
  typeof window !== "undefined" && typeof window.utools !== "undefined";

async function resolveImageSrc(src: string): Promise<string> {
  // 已经是 http(s) 或 data URL，直接返回
  if (src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }

  // 尝试用 imageStorage 加载本地存储的图片
  if (src.startsWith("att:") || src.startsWith("uuid:")) {
    try {
      const blob = await imageStorage.load(src);
      if (blob) {
        return URL.createObjectURL(blob);
      }
    } catch {
      // fallthrough
    }
  }

  // 其他情况原样返回（可能是相对路径等）
  return src;
}

function getImageElements(container: HTMLElement): HTMLImageElement[] {
  return Array.from(container.querySelectorAll<HTMLImageElement>(
    '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img'
  ));
}

export function ImageLightbox({ editorContainerRef }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const resolvedUrlsRef = useRef<Map<string, string>>(new Map());
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    });
    objectUrlsRef.current.clear();
    resolvedUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      cleanupObjectUrls();
    };
  }, [cleanupObjectUrls]);

  const buildSlides = useCallback(async (container: HTMLElement): Promise<SlideInfo[]> => {
    const images = getImageElements(container);
    const slides: SlideInfo[] = [];

    for (const img of images) {
      const src = img.src || img.getAttribute("src") || "";
      const alt = img.alt || img.getAttribute("alt") || "";

      if (!src) continue;

      // 检查是否已解析过
      let resolved = resolvedUrlsRef.current.get(src);
      if (!resolved) {
        resolved = await resolveImageSrc(src);
        resolvedUrlsRef.current.set(src, resolved);
        if (resolved.startsWith("blob:")) {
          objectUrlsRef.current.add(resolved);
        }
      }

      slides.push({ src: resolved, alt });
    }

    return slides;
  }, []);

  const handleImageClick = useCallback(async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const img = target.closest<HTMLImageElement>(
      '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img'
    );
    if (!img) return;

    const container = editorContainerRef.current;
    if (!container) return;

    // 阻止编辑器内部的默认行为（如选中文字）
    event.preventDefault();
    event.stopPropagation();

    const images = getImageElements(container);
    const clickedIndex = images.indexOf(img);
    if (clickedIndex < 0) return;

    const newSlides = await buildSlides(container);
    if (newSlides.length === 0) return;

    setSlides(newSlides);
    setIndex(clickedIndex);
    setOpen(true);
  }, [editorContainerRef, buildSlides]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    container.addEventListener("click", handleImageClick);
    return () => {
      container.removeEventListener("click", handleImageClick);
    };
  }, [editorContainerRef, handleImageClick]);

  const currentSlide = slides[index];

  const handleDownload = useCallback(async () => {
    if (!currentSlide) return;
    try {
      const response = await fetch(currentSlide.src);
      const blob = await response.blob();
      const ext = blob.type === "image/png" ? "png"
        : blob.type === "image/jpeg" || blob.type === "image/jpg" ? "jpg"
        : blob.type === "image/gif" ? "gif"
        : blob.type === "image/webp" ? "webp"
        : "png";
      const filename = `image-${Date.now()}.${ext}`;
      const saved = await saveBlobAndReveal(blob, filename);
      if (saved) {
        toast.success("图片已保存");
      } else {
        // fallback: 浏览器原生下载
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("已开始下载");
      }
    } catch (err) {
      toast.error(`下载失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [currentSlide]);

  const handleCopy = useCallback(async () => {
    if (!currentSlide) return;
    try {
      const response = await fetch(currentSlide.src);
      const blob = await response.blob();

      if (isUToolsEnv() && typeof window.utools?.copyImage === "function") {
        const base64 = await blobToBase64(blob);
        window.utools.copyImage(base64);
        toast.success("已复制到剪贴板");
        return;
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success("已复制到剪贴板");
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [currentSlide]);

  if (slides.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={() => setOpen(false)}
      index={index}
      slides={slides.map((s) => ({ src: s.src, alt: s.alt }))}
      plugins={[Zoom]}
      zoom={{ maxZoomPixelRatio: 3 }}
      carousel={{ finite: slides.length <= 1 }}
      controller={{ closeOnBackdropClick: true }}
      toolbar={{
        buttons: [
          <button
            key="download"
            type="button"
            title="下载图片"
            onClick={handleDownload}
            className="yarl__button"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Download size={20} />
          </button>,
          <button
            key="copy"
            type="button"
            title="复制图片"
            onClick={handleCopy}
            className="yarl__button"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Copy size={20} />
          </button>,
          "close",
        ],
      }}
      render={{
        buttonClose: () => (
          <button
            type="button"
            title="关闭"
            className="yarl__button"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
        ),
      }}
      styles={{
        container: { backgroundColor: "rgba(0, 0, 0, 0.85)" },
      }}
      on={{ view: ({ index: newIndex }) => setIndex(newIndex) }}
    />
  );
}
