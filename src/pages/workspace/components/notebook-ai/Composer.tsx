/**
 * Notebook AI composer — wraps the shared @-aware AI composer input.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AiComposerInput,
  type AiComposerInputHandle,
} from "@/components/editor/ai/composer/AiComposerInput";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import type {
  AiComposerPayload,
  AiFileReferenceAttrs,
  AiReferenceSuggestionItem,
} from "@/components/editor/ai/composer/referenceLookup";
import {
  isImageUploadFile,
  resolveImageMimeForUpload,
} from "@/components/editor/utils/pasteClipboardImage";

const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export interface NotebookAiImageAttachment {
  file: File;
  previewUrl: string;
}

interface ComposerProps {
  onSend: (
    payload: AiComposerPayload,
    images: NotebookAiImageAttachment[],
  ) => boolean | void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPages?: (query: string) => AiReferenceSuggestionItem[];
  onEscape?: () => void;
  initialReference?: AiFileReferenceAttrs | null;
}

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "向 AI 提问，输入 @ 引用当前笔记本页面…",
  searchPages,
  onEscape,
  initialReference,
}: ComposerProps) {
  const inputRef = useRef<AiComposerInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<NotebookAiImageAttachment[]>([]);
  const { onOpenPage } = useEditorPageContext();
  const [isEmpty, setIsEmpty] = useState(true);
  const [autoFocusToken, setAutoFocusToken] = useState(0);
  const [references, setReferences] = useState<AiFileReferenceAttrs[]>(() =>
    initialReference ? [initialReference] : [],
  );
  const [images, setImages] = useState<NotebookAiImageAttachment[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  const handleEscape = useCallback(() => {
    onEscape?.();
  }, [onEscape]);

  const handleSubmit = useCallback(() => {
    if (disabled || isStreaming || (isEmpty && images.length === 0)) return;
    const payload = inputRef.current?.getPayload();
    if (!payload || (!payload.promptText.trim() && images.length === 0)) return;

    const seenReferenceIds = new Set<string>();
    const mergedReferences = [...references, ...payload.references].filter(
      (reference) => {
        if (!reference.pageId || seenReferenceIds.has(reference.pageId)) {
          return false;
        }
        seenReferenceIds.add(reference.pageId);
        return true;
      },
    );
    const accepted = onSend(
      { ...payload, references: mergedReferences },
      images,
    );
    if (accepted === false) return;

    inputRef.current?.clear();
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setIsEmpty(true);
    setAutoFocusToken((token) => token + 1);
  }, [disabled, images, isStreaming, isEmpty, onSend, references]);

  const addReference = useCallback((reference: AiFileReferenceAttrs) => {
    setReferences((current) =>
      current.some((item) => item.pageId === reference.pageId)
        ? current
        : [...current, reference],
    );
  }, []);

  const removeReference = useCallback((pageId: string) => {
    setReferences((current) =>
      current.filter((reference) => reference.pageId !== pageId),
    );
  }, []);

  const handleImageInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (selectedFiles.length === 0) return;

      const available = MAX_IMAGE_ATTACHMENTS - images.length;
      if (available <= 0) {
        toast.error(`每次最多添加 ${MAX_IMAGE_ATTACHMENTS} 张图片。`);
        return;
      }

      const accepted = selectedFiles
        .filter(isImageUploadFile)
        .filter((file) => {
          if (file.size <= MAX_IMAGE_FILE_BYTES) return true;
          toast.error(`“${file.name}”超过 10MB，未添加。`);
          return false;
        })
        .filter((file) =>
          SUPPORTED_IMAGE_MEDIA_TYPES.has(resolveImageMimeForUpload(file)),
        )
        .slice(0, available)
        .map((file) => {
          const mediaType = resolveImageMimeForUpload(file);
          const normalizedFile =
            file.type === mediaType
              ? file
              : new File([file], file.name, {
                  type: mediaType,
                  lastModified: file.lastModified,
                });
          return {
            file: normalizedFile,
            previewUrl: URL.createObjectURL(normalizedFile),
          };
        });

      if (accepted.length === 0) {
        toast.error("请选择 PNG、JPEG、WebP 或 GIF 图片。");
        return;
      }
      if (accepted.length < selectedFiles.length) {
        toast.message(`已添加 ${accepted.length} 张图片。`);
      }
      setImages((current) => [...current, ...accepted]);
    },
    [images.length],
  );

  const removeImage = useCallback((previewUrl: string) => {
    setImages((current) => {
      const target = current.find((image) => image.previewUrl === previewUrl);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.previewUrl !== previewUrl);
    });
  }, []);

  const canSend = !isStreaming && !disabled && (!isEmpty || images.length > 0);

  return (
    <div className="shrink-0 px-3 py-2.5">
      {(references.length > 0 || images.length > 0) && (
        <div
          className="mb-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="本轮上下文与图片"
        >
          {references.map((reference) => (
            <div
              key={reference.pageId}
              className="group flex h-7 max-w-[80%] shrink-0 items-center rounded-[7px] bg-[var(--goose-interactive-selected)] text-xs text-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] focus-within:bg-[var(--goose-interactive-hover)] focus-within:ring-1 focus-within:ring-ring"
            >
              <button
                type="button"
                onClick={() => onOpenPage(reference.pageId)}
                className="flex min-w-0 items-center gap-1.5 py-1 pl-2 pr-1.5 outline-none"
                aria-label={`打开页面：${reference.titleSnapshot}`}
                title={`打开“${reference.titleSnapshot}”`}
              >
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 truncate">
                  {reference.titleSnapshot}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeReference(reference.pageId)}
                className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`移除页面上下文：${reference.titleSnapshot}`}
                title={`移除“${reference.titleSnapshot}”`}
              >
                <X className="h-3 w-3" strokeWidth={1.9} />
              </button>
            </div>
          ))}
          {images.map((image) => (
            <div
              key={image.previewUrl}
              className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-[7px] bg-[var(--goose-interactive-hover)]"
            >
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(image.previewUrl)}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-[4px] bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`移除图片 ${image.file.name}`}
                title={`移除 ${image.file.name}`}
              >
                <X className="h-3 w-3" strokeWidth={1.9} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-[10px] border border-border bg-background px-3 py-2",
          "focus-within:border-border",
          "transition-colors duration-150",
        )}
      >
        <AiComposerInput
          ref={inputRef}
          placeholder={placeholder}
          autoFocusToken={autoFocusToken}
          onSubmit={handleSubmit}
          onEscape={handleEscape}
          onIsEmptyChange={setIsEmpty}
          onReferenceAdded={addReference}
          searchPages={searchPages}
          referencePlacement="external"
          variant="panel"
          disabled={disabled || isStreaming}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={handleImageInput}
          disabled={disabled || isStreaming}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={
            disabled || isStreaming || images.length >= MAX_IMAGE_ATTACHMENTS
          }
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="上传图片"
          title={
            images.length >= MAX_IMAGE_ATTACHMENTS
              ? `最多 ${MAX_IMAGE_ATTACHMENTS} 张图片`
              : "上传图片"
          }
        >
          <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className={cn(
              "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]",
              "bg-[var(--goose-interactive-selected)] text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
            )}
            aria-label="停止生成"
            title="停止生成"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]",
              "transition-colors duration-150",
              canSend
                ? "bg-[var(--goose-interactive-selected)] text-muted-foreground hover:text-foreground"
                : "cursor-not-allowed text-muted-foreground opacity-50",
            )}
            aria-label="发送消息"
            title="发送消息"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
