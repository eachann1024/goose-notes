/**
 * Notebook AI composer — 附件（页面引用 + 图片）以 chip 形式内联在输入框中。
 * 文本与 @ 引用草稿按 notebook 持久化，切页 / 关面板 / 退出插件后可恢复。
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ImagePlus, Send, Square } from "lucide-react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  AiComposerInput,
  type AiComposerInputHandle,
} from "@/components/editor/ai/composer/AiComposerInput";
import {
  normalizeAiComposerPayload,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
  type AiReferenceSuggestionItem,
} from "@/components/editor/ai/composer/referenceLookup";
import {
  isImageUploadFile,
  resolveImageMimeForUpload,
} from "@/components/editor/utils/pasteClipboardImage";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import type { JSONContent } from "@/types";
import { ModelSelectorPopover } from "./ModelSelectorPopover";

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

export interface ComposerHandle {
  /** 聚焦输入框 */
  focus: () => void;
  /** 打开面板后立即给输入框植入初始引用（当前页上下文） */
  insertReference: (reference: AiFileReferenceAttrs) => void;
}

interface ComposerProps {
  /** 用于按笔记本持久化输入草稿 */
  notebookId: string;
  onSend: (
    payload: AiComposerPayload,
    images: NotebookAiImageAttachment[],
  ) => boolean | void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPages?: (query: string) => AiReferenceSuggestionItem[];
  onEscape?: () => void;
  /** 全屏时输入区居中加宽 */
  layout?: "side-panel" | "fullscreen";
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(
    {
      notebookId,
      onSend,
      isStreaming,
      disabled,
      placeholder = "向 AI 提问，/ 调用 Skill，@ 引用笔记或本地文件…",
      searchPages,
      onEscape,
      layout = "side-panel",
    },
    ref,
  ) {
    const isFullscreen = layout === "fullscreen";
    const inputRef = useRef<AiComposerInputHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [autoFocusToken, setAutoFocusToken] = useState(0);
    // 仅在挂载时读一次草稿作种子；运行中由 onContentChange 写回 store，
    // 避免把 store 回灌成受控值导致 contenteditable 选区被重建。
    const [seedContent] = useState<JSONContent | null>(() =>
      useNotebookAiChats.getState().getComposerDraft(notebookId),
    );

    const handleEscape = useCallback(() => {
      onEscape?.();
    }, [onEscape]);

    const handleContentChange = useCallback(
      (content: JSONContent | null) => {
        useNotebookAiChats.getState().setComposerDraft(notebookId, content);
      },
      [notebookId],
    );

    const handleSubmit = useCallback(() => {
      if (disabled || isStreaming) return;
      const input = inputRef.current;
      const payload = input?.getPayload();
      if (!payload) return;

      const images = input?.resolveImages(payload) ?? [];
      if (!payload.promptText.trim() && images.length === 0) return;

      const normalized = normalizeAiComposerPayload(payload);
      const accepted = onSend(normalized.payload, images);
      if (accepted === false) return;

      input?.clear();
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      setIsEmpty(true);
      setAutoFocusToken((token) => token + 1);
    }, [disabled, isStreaming, onSend, notebookId]);

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

    /** 粘贴图片 → 插入到光标处 */
    const handleDockPaste = useCallback(
      (event: React.ClipboardEvent) => {
        if (disabled || isStreaming) return;
        const files = Array.from(event.clipboardData?.files ?? []);
        const imageFiles = files.filter(isImageUploadFile);
        if (imageFiles.length === 0) return;
        event.preventDefault();
        addImageFiles(imageFiles);
      },
      [addImageFiles, disabled, isStreaming],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
        },
        insertReference: (reference: AiFileReferenceAttrs) => {
          inputRef.current?.insertReference(reference);
        },
      }),
      [],
    );

    const canSend = !isStreaming && !disabled && !isEmpty;

    return (
      <ComposerPrimitive.Root
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className={cn("shrink-0", isFullscreen ? "px-6 py-3" : "px-3 py-2.5")}
      >
        <div
          className={cn(
            "mx-auto w-full",
            isFullscreen ? "max-w-[720px]" : "max-w-none",
          )}
        >
          {/* dock：输入 + 工具行 一体，附件 chip 全部内联在输入框中 */}
          <div
            className={cn(
              "flex flex-col rounded-[16px] bg-[var(--goose-interactive-hover)] px-3 py-2.5",
              "shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)]",
              "transition-colors duration-150",
            )}
            onPaste={handleDockPaste}
          >
            <AiComposerInput
              ref={inputRef}
              placeholder={placeholder}
              autoFocusToken={autoFocusToken}
              initialContent={seedContent}
              onContentChange={handleContentChange}
              onSubmit={handleSubmit}
              onEscape={handleEscape}
              onIsEmptyChange={setIsEmpty}
              searchPages={searchPages}
              referencePlacement="inline"
              variant="panel"
              disabled={disabled || isStreaming}
              maxImageBytes={MAX_IMAGE_FILE_BYTES}
              maxImageCount={MAX_IMAGE_ATTACHMENTS}
              onImageRejected={(message) => toast.error(message)}
            />

            <div className="mt-1.5 flex items-center gap-1">
              <ModelSelectorPopover disabled={disabled} />
              <div className="flex-1" />

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
                disabled={disabled || isStreaming}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-foreground dark:hover:bg-[var(--goose-interactive-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="上传图片"
                title="上传图片"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
              </button>

              {isStreaming ? (
                <ComposerPrimitive.Cancel
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
                    "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]",
                    "transition-colors duration-150",
                  )}
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
                </ComposerPrimitive.Cancel>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
                    "transition-colors duration-150",
                    canSend
                      ? "bg-[#58d7b8]/15 text-[#58d7b8] hover:brightness-110"
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
        </div>
      </ComposerPrimitive.Root>
    );
  },
);

Composer.displayName = "Composer";
