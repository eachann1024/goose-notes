import { useCallback, useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Zoom } from "yet-another-react-lightbox/plugins";
import { AlignCenter, AlignLeft, AlignRight, Copy, Download, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import type { BlockNoteEditor } from "@blocknote/core";
import { imageStorage } from "@/lib/imageStorage";
import { isLocalFilePath, resolveToAbsolute, readLocalFileAsBlob } from "@/lib/imageStorage/strategies/file-system";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import { saveBlobAndReveal } from "@/lib/export";
import { cn } from "@/lib/utils";
import { shell } from "@/lib/utools/shell";
import { usePages } from "@/stores/usePages";

interface ImageLightboxProps {
  editor: BlockNoteEditor<any, any, any>;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface SlideInfo {
  src: string;
  alt?: string;
}

type ImageAlignment = "left" | "center" | "right";

interface SelectedImageState {
  blockId: string | null;
  src: string;
  alt?: string;
  index: number;
  rect: DOMRect;
  alignment: ImageAlignment;
}

async function resolveImageSrc(src: string): Promise<string> {
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  // 本地文件路径：优先相对于页面文件目录解析
  if (isLocalFilePath(src)) {
    try {
      const activePageId = usePages.getState().activePageId;
      const activePage = activePageId ? usePages.getState().pages[activePageId] : null;
      if (activePage?.localFilePath) {
        const pageDir = activePage.localFilePath.replace(/[\\/][^\\/]+$/, '');
        const fullPath = resolveToAbsolute(pageDir, src);
        const blob = readLocalFileAsBlob(fullPath);
        if (blob) return URL.createObjectURL(blob);
      }
    } catch {
      // fallthrough to imageStorage
    }
  }

  // att: / uuid: 内部引用或本地文件路径兜底，走 imageStorage.load
  try {
    const blob = await imageStorage.load(src);
    if (blob) {
      return URL.createObjectURL(blob);
    }
  } catch {
    // fallthrough
  }

  return src;
}

function getImageElements(container: HTMLElement): HTMLImageElement[] {
  return Array.from(container.querySelectorAll<HTMLImageElement>(
    '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img'
  ));
}

function getImageBlockElement(img: HTMLImageElement, container: HTMLElement): HTMLElement | null {
  let element: HTMLElement | null = img;
  while (element && element !== container) {
    if (element.classList.contains("bn-block-outer")) return element;
    element = element.parentElement;
  }
  return img.closest<HTMLElement>(".bn-block-outer");
}

function getBlockIdFromImage(img: HTMLImageElement, container: HTMLElement): string | null {
  const candidates: HTMLElement[] = [];
  let element: HTMLElement | null = img;
  while (element && element !== container) {
    candidates.push(element);
    element = element.parentElement;
  }

  for (const candidate of candidates) {
    const id =
      candidate.dataset.id ||
      candidate.dataset.blockId ||
      candidate.getAttribute("data-id") ||
      candidate.getAttribute("data-block-id");
    if (id) return id;
  }

  return null;
}

function getImageSrc(img: HTMLImageElement): string {
  return img.currentSrc || img.src || img.getAttribute("src") || "";
}

function getImageBlockIdByIndex(blocks: any[], imageIndex: number): string | null {
  let currentIndex = -1;
  let result: string | null = null;

  const visit = (items: any[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "image" || item.type === "imageResize") {
        currentIndex += 1;
        if (currentIndex === imageIndex) {
          result = item.id ?? null;
          return;
        }
      }
      if (Array.isArray(item.children)) visit(item.children);
      if (result) return;
    }
  };

  visit(blocks);
  return result;
}

function getImageAlignmentFromBlock(block: any): ImageAlignment {
  const value = block?.props?.textAlignment || block?.props?.alignment;
  return value === "center" || value === "right" ? value : "left";
}

function getImageExtension(blob: Blob): string {
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/jpeg" || blob.type === "image/jpg") return "jpg";
  if (blob.type === "image/gif") return "gif";
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/svg+xml") return "svg";
  return "png";
}

export function ImageLightbox({ editor, editorContainerRef }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(null);
  const resolvedUrlsRef = useRef<Map<string, string>>(new Map());
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const selectedImageRef = useRef<SelectedImageState | null>(null);

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

  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);

  const buildSlides = useCallback(async (container: HTMLElement): Promise<SlideInfo[]> => {
    const images = getImageElements(container);
    const slides: SlideInfo[] = [];

    for (const img of images) {
      const src = img.src || img.getAttribute("src") || "";
      const alt = img.alt || img.getAttribute("alt") || "";

      if (!src) continue;

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

  const openLightboxAtImage = useCallback(async (img: HTMLImageElement) => {
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
  }, [editorContainerRef, buildSlides]);

  const handleImageDoubleClick = useCallback(async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const img = target.closest<HTMLImageElement>(
      '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img'
    );
    if (!img) return;

    event.preventDefault();
    event.stopPropagation();

    await openLightboxAtImage(img);
  }, [openLightboxAtImage]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    container.addEventListener("dblclick", handleImageDoubleClick);
    return () => {
      container.removeEventListener("dblclick", handleImageDoubleClick);
    };
  }, [editorContainerRef, handleImageDoubleClick]);

  const updateSelectedImageFromElement = useCallback((img: HTMLImageElement) => {
    const container = editorContainerRef.current;
    if (!container) return;

    const imageIndex = getImageElements(container).indexOf(img);
    const blockId =
      getBlockIdFromImage(img, container) ||
      getImageBlockIdByIndex(editor.document as any[], imageIndex);
    const block = blockId ? editor.getBlock(blockId) : null;
    const blockElement = getImageBlockElement(img, container);

    setSelectedImage({
      blockId,
      src: getImageSrc(img),
      alt: img.alt || img.getAttribute("alt") || "",
      index: imageIndex,
      rect: (blockElement ?? img).getBoundingClientRect(),
      alignment: getImageAlignmentFromBlock(block),
    });
  }, [editor, editorContainerRef]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const img = target?.closest<HTMLImageElement>(
        '.bn-block-content[data-content-type="image"] img, .bn-block-content[data-content-type="imageResize"] img'
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

  const currentSlide = slides[index];

  const downloadImage = useCallback(async (src: string) => {
    let resolvedObjectUrl: string | null = null;
    try {
      const resolvedSrc = await resolveImageSrc(src);
      if (resolvedSrc.startsWith("blob:") && resolvedSrc !== src) {
        resolvedObjectUrl = resolvedSrc;
      }
      const response = await fetch(resolvedSrc);
      const blob = await response.blob();
      const ext = getImageExtension(blob);
      const filename = `image-${Date.now()}.${ext}`;
      const saved = await saveBlobAndReveal(blob, filename);
      if (saved) {
        toast.success("图片已保存");
      } else {
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
    } finally {
      if (resolvedObjectUrl) {
        try { URL.revokeObjectURL(resolvedObjectUrl); } catch { /* ignore */ }
      }
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!currentSlide) return;
    await downloadImage(currentSlide.src);
  }, [currentSlide, downloadImage]);

  const handleCopy = useCallback(async () => {
    if (!currentSlide) return;
    try {
      const response = await fetch(currentSlide.src);
      const blob = await response.blob();

      const base64 = await blobToBase64(blob);
      shell.copyImage(base64);
      toast.success("已复制到剪贴板");
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [currentSlide]);

  const applyImageAlignment = useCallback((alignment: ImageAlignment) => {
    if (!selectedImage?.blockId) return;
    const block = editor.getBlock(selectedImage.blockId);
    if (!block) return;

    editor.updateBlock(block, {
      props: { textAlignment: alignment },
    } as any);

    setSelectedImage((current) =>
      current ? { ...current, alignment } : current,
    );
  }, [editor, selectedImage]);

  const handleSelectedImageZoom = useCallback(async () => {
    const container = editorContainerRef.current;
    if (!container || !selectedImage) return;
    const img = getImageElements(container)[selectedImage.index];
    if (!img) return;
    await openLightboxAtImage(img);
  }, [editorContainerRef, openLightboxAtImage, selectedImage]);

  const handleSelectedImageDownload = useCallback(async () => {
    if (!selectedImage) return;
    await downloadImage(selectedImage.src);
  }, [downloadImage, selectedImage]);

  const toolbar = selectedImage && !open ? (
    <div
      data-goose-image-toolbar
      className="fixed z-[20000] flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-150 dark:border-white/15 dark:bg-[#2f3437]"
      style={{
        top: Math.max(8, selectedImage.rect.top - 42),
        left: selectedImage.rect.left + selectedImage.rect.width / 2,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {([
        ["left", "左对齐", AlignLeft],
        ["center", "居中对齐", AlignCenter],
        ["right", "右对齐", AlignRight],
      ] as const).map(([alignment, label, Icon]) => (
        <button
          key={alignment}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => applyImageAlignment(alignment)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted",
            selectedImage.alignment === alignment && "bg-accent text-foreground",
          )}
        >
          <Icon className="h-[15px] w-[15px]" />
        </button>
      ))}

      <div className="mx-0.5 h-5 w-px bg-border/70" />

      <button
        type="button"
        title="放大图片"
        aria-label="放大图片"
        onClick={handleSelectedImageZoom}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted"
      >
        <Maximize2 className="h-[15px] w-[15px]" />
      </button>
      <button
        type="button"
        title="下载图片"
        aria-label="下载图片"
        onClick={handleSelectedImageDownload}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted"
      >
        <Download className="h-[15px] w-[15px]" />
      </button>
    </div>
  ) : null;

  return (
    <>
      {toolbar}
      {slides.length > 0 && (
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
                key="close"
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
      )}
    </>
  );
}
