import { copyText, downloadText, copyImagePayload } from "./artifactClipboard";
import { useState } from "react";
import {
  Copy,
  Download,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Maximize2,
} from "@/components/ui/icons";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";
import { saveBlobAndReveal } from "@/lib/export/fileSave";
import {
  PREVIEW_ACTION_TOOLTIP,
  openPreviewInSystem,
  previewPointerHandlers,
  type PreviewContent,
} from "@/lib/preview/previewAction";
import type { ArtifactActionsProps } from "./artifactActionTypes";

const iconBtnClass =
  "h-7 w-7 cursor-pointer rounded-[7px] text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] dark:hover:bg-[var(--goose-interactive-hover)]";

export function ArtifactActions({
  copySource,
  downloadSource,
  filename = "artifact.txt",
  mimeType = "text/plain;charset=utf-8",
  onCopyImage,
  onDownloadImage,
  downloadImageFilename = "artifact.png",
  onPreview,
  onPreviewImage,
  previewFilename = "preview.png",
  onInsert,
}: ArtifactActionsProps) {
  const [copyingImage, setCopyingImage] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(
    null,
  );

  const hasSourceCopy = Boolean(copySource?.trim());
  const hasImageCopy = Boolean(onCopyImage);
  const hasImageDownload = Boolean(onDownloadImage);
  const hasSourceDownload =
    Boolean(downloadSource?.trim()) && !hasImageDownload;
  const hasPreview = Boolean(onPreview || onPreviewImage);

  if (
    !hasSourceCopy &&
    !hasImageCopy &&
    !hasImageDownload &&
    !hasSourceDownload &&
    !hasPreview &&
    !onInsert
  ) {
    return null;
  }

  const resolvePreview = async (): Promise<PreviewContent> => {
    if (onPreview) return onPreview();
    if (onPreviewImage) {
      return {
        kind: "image",
        data: await onPreviewImage(),
        fileName: previewFilename,
      };
    }
    throw new Error("预览不可用");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="notebook-ai-artifact-actions flex shrink-0 items-center gap-0.5">
        {hasImageCopy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                aria-label="复制图片"
                disabled={copyingImage}
                onClick={() => {
                  if (!onCopyImage || copyingImage) return;
                  setCopyingImage(true);
                  void (async () => {
                    try {
                      const payload = await onCopyImage();
                      await copyImagePayload(payload);
                    } catch (err) {
                      toast.error(
                        `复制失败：${err instanceof Error ? err.message : "未知错误"}`,
                      );
                    } finally {
                      setCopyingImage(false);
                    }
                  })();
                }}
              >
                {copyingImage ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制图片</TooltipContent>
          </Tooltip>
        ) : null}

        {hasSourceCopy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                aria-label="复制源码"
                onClick={() => void copyText(copySource!)}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制源码</TooltipContent>
          </Tooltip>
        ) : null}

        {onInsert ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                aria-label="插入当前笔记"
                onClick={async () => {
                  const result = await onInsert();
                  toast[result.ok ? "success" : "error"](
                    result.ok ? "已插入当前笔记" : result.error,
                  );
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>插入当前笔记</TooltipContent>
          </Tooltip>
        ) : null}

        {hasPreview ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                disabled={previewing}
                {...previewPointerHandlers({
                  disabled: previewing,
                  onInternal: () => {
                    if (previewing) return;
                    setPreviewing(true);
                    void (async () => {
                      try {
                        setPreviewContent(await resolvePreview());
                      } catch (err) {
                        toast.error(
                          `预览失败：${err instanceof Error ? err.message : "未知错误"}`,
                        );
                      } finally {
                        setPreviewing(false);
                      }
                    })();
                  },
                  onSystem: () => {
                    if (previewing) return;
                    setPreviewing(true);
                    void (async () => {
                      try {
                        await openPreviewInSystem(await resolvePreview());
                      } catch (err) {
                        toast.error(
                          `系统预览失败：${err instanceof Error ? err.message : "未知错误"}`,
                        );
                      } finally {
                        setPreviewing(false);
                      }
                    })();
                  },
                })}
              >
                {previewing ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{PREVIEW_ACTION_TOOLTIP}</TooltipContent>
          </Tooltip>
        ) : null}

        {hasImageDownload ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="notebook-ai-canvas-card-download h-7 gap-1 rounded-[7px] px-2 text-xs text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
            aria-label="下载图片"
            disabled={downloadingImage}
            onClick={() => {
              if (!onDownloadImage || downloadingImage) return;
              setDownloadingImage(true);
              void (async () => {
                try {
                  const blob = await onDownloadImage();
                  await saveBlobAndReveal(blob, downloadImageFilename);
                  toast.success("已保存");
                } catch (err) {
                  toast.error(
                    `下载失败：${err instanceof Error ? err.message : "未知错误"}`,
                  );
                } finally {
                  setDownloadingImage(false);
                }
              })();
            }}
          >
            {downloadingImage ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            下载
          </Button>
        ) : hasSourceDownload ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="notebook-ai-canvas-card-download h-7 gap-1 rounded-[7px] px-2 text-xs text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
            aria-label="下载"
            onClick={() =>
              void downloadText(downloadSource!, filename, mimeType)
            }
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            下载
          </Button>
        ) : null}
      </div>
      <FullscreenPreview
        open={Boolean(previewContent)}
        content={previewContent}
        onClose={() => setPreviewContent(null)}
      />
    </TooltipProvider>
  );
}
