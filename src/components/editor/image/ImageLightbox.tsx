import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Zoom } from "yet-another-react-lightbox/plugins";
import { Copy, Download, X, ZoomIn, ZoomOut } from "@/components/ui/icons";
import { PREVIEW_ACTION_TOOLTIP } from "@/lib/preview/previewAction";
import { ImageToolbar } from "./ImageToolbar";
import { useLightboxSlides } from "./useLightboxSlides";
import { useLightboxActions } from "./useLightboxActions";
import { useSelectedImage } from "./useSelectedImage";
import type { ImageLightboxProps } from "./lightboxTypes";

export function ImageLightbox({
  editor,
  editorContainerRef,
  editable = true,
}: ImageLightboxProps) {
  const {
    open,
    setOpen,
    index,
    setIndex,
    slides,
    currentSlide,
    openLightboxAtImage,
  } = useLightboxSlides(editorContainerRef);
  const actions = useLightboxActions(editor, editorContainerRef, currentSlide);
  const { handleDownload, handleCopy } = actions;
  const {
    selectedImage,
    applyImageAlignment,
    handleSelectedImageZoom,
    handleSelectedImageSystemPreview,
    getSelectedImageRect,
    handleSelectedImageDownload,
    handleSelectedImageCopy,
  } = useSelectedImage(
    editor,
    editorContainerRef,
    openLightboxAtImage,
    actions,
  );
  return (
    <>
      {selectedImage && !open && editable && (
        <ImageToolbar
          selectedImage={selectedImage}
          applyImageAlignment={applyImageAlignment}
          handleSelectedImageZoom={handleSelectedImageZoom}
          handleSelectedImageSystemPreview={handleSelectedImageSystemPreview}
          handleSelectedImageCopy={handleSelectedImageCopy}
          handleSelectedImageDownload={handleSelectedImageDownload}
          openImageLabel={PREVIEW_ACTION_TOOLTIP}
          floatingBoundary={
            !__GOOSE_EDITOR_COMPACT__ ? editorContainerRef.current : undefined
          }
          getReferenceRect={
            !__GOOSE_EDITOR_COMPACT__ ? getSelectedImageRect : undefined
          }
        />
      )}
      {slides.length > 0 && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={index}
          slides={slides.map((s) => ({
            src: s.src,
            alt: s.alt,
            title: s.alt || undefined,
          }))}
          plugins={[Zoom]}
          zoom={{
            maxZoomPixelRatio: 4,
            scrollToZoom: true,
            doubleClickDelay: 250,
          }}
          labels={{
            "Zoom in": "放大",
            "Zoom out": "缩小",
            Close: "关闭",
            Next: "下一张",
            Previous: "上一张",
          }}
          carousel={{ finite: slides.length <= 1, padding: "48px" }}
          controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
          animation={{ fade: 220, swipe: 280 }}
          className="goose-image-lightbox"
          toolbar={{
            buttons: [
              <div key="title" className="goose-image-lightbox-title">
                {currentSlide?.alt || "图片预览"}
              </div>,
              // Zoom 插件默认把按钮前置插入工具条；用占位符锁定它在右侧操作组的位置
              "zoom",
              <button
                key="download"
                type="button"
                title="下载图片"
                aria-label="下载图片"
                onClick={handleDownload}
                className="yarl__button"
              >
                <Download size={18} strokeWidth={1.75} />
              </button>,
              <button
                key="copy"
                type="button"
                title="复制图片"
                aria-label="复制图片"
                onClick={handleCopy}
                className="yarl__button"
              >
                <Copy size={18} strokeWidth={1.75} />
              </button>,
              "close",
            ],
          }}
          render={{
            iconZoomIn: () => (
              <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
            ),
            iconZoomOut: () => (
              <ZoomOut size={18} strokeWidth={1.75} aria-hidden="true" />
            ),
            buttonClose: () => (
              <button
                key="close"
                type="button"
                title="关闭"
                aria-label="关闭"
                onClick={() => setOpen(false)}
                className="yarl__button"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            ),
            buttonPrev: slides.length <= 1 ? () => null : undefined,
            buttonNext: slides.length <= 1 ? () => null : undefined,
          }}
          on={{ view: ({ index: newIndex }) => setIndex(newIndex) }}
        />
      )}
    </>
  );
}
