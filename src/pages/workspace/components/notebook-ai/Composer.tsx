/**
 * Notebook AI composer — 附件（页面引用 + 图片）以 chip 形式内联在输入框中。
 * 文本与 @ 引用草稿按 notebook 持久化，切页 / 关面板 / 退出插件后可恢复。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ArrowUp, Plus } from "lucide-react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { LoadingState } from "./beautiful-ui/LoadingState";
import { PromptBar } from "./beautiful-ui/PromptBar";
import {
  AiComposerInput,
  type AiComposerInputHandle,
} from "@/components/editor/ai/composer/AiComposerInput";
import { isEditorDomEmpty } from "@/components/editor/ai/composer/composerChipDom";
import { isComposerPayloadEmpty } from "@/components/editor/ai/composer/composerTokens";
import {
  measureNowrapContentSize,
  measureSingleLineSlot,
  shouldExpandComposer,
} from "@/components/editor/ai/composer/composerExpandLayout";
import {
  normalizeAiComposerPayload,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
  type AiReferenceSuggestionItem,
} from "@/components/editor/ai/composer/referenceLookup";
import {
  APPEND_COMPOSER_SELECTION_EVENT,
  SELECTION_QUOTE_DUPLICATE_TOAST,
  buildSelectionQuoteAttrs,
  consumePendingAppendComposerSelections,
  type AppendComposerSelectionDetail,
  type AiSelectionQuoteAttrs,
} from "@/components/editor/ai/composer/selectionQuote";
import {
  extractClipboardImageFiles,
  isImageUploadFile,
  resolveImageMimeForUpload,
} from "@/components/editor/utils/pasteClipboardImage";
import {
  composerDraftHasContent,
  useNotebookAiChats,
} from "@/stores/useNotebookAiChats";
import type { JSONContent } from "@/types";
import { ModelSelectorPopover } from "./ModelSelectorPopover";
import {
  matchComposerPayloadSlashCommand,
  type ComposerSlashBuiltinId,
} from "@/lib/notebook-ai/composerSlashCommands";

const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
/** 草稿走 zustand persist → Electron 同步写盘，必须防抖（含整行删除后的清空） */
const COMPOSER_DRAFT_PERSIST_MS = 500;
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
  /** 空会话默认 @ 仍可替换时，改成最新当前页 */
  replaceDefaultPageReference: (
    reference: AiFileReferenceAttrs,
  ) => "applied" | "already" | "skipped";
  /** 静默把选区引用 chip 追加到输入框末尾 */
  appendSelectionQuote: (
    quote: AiSelectionQuoteAttrs,
    options?: { restoreCaret?: boolean; animate?: boolean },
  ) => "appended" | "duplicate" | "skipped";
}

interface ComposerProps {
  /** 用于按笔记本持久化输入草稿 */
  notebookId: string;
  /** 面板解析后的初始草稿；不传则读 store */
  initialContent?: JSONContent | null;
  onSend: (
    payload: AiComposerPayload,
    images: NotebookAiImageAttachment[],
  ) => boolean | void;
  onSlashCommand?: (id: ComposerSlashBuiltinId) => void;
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
      initialContent,
      onSend,
      onSlashCommand,
      isStreaming,
      disabled,
      placeholder = "向 AI 提问，/ 调用指令或 Skill，@ 引用笔记或本地文件…",
      searchPages,
      onEscape,
      layout = "side-panel",
    },
    ref,
  ) {
    const isFullscreen = layout === "fullscreen";
    const inputRef = useRef<AiComposerInputHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftSeqRef = useRef(0);
    const [autoFocusToken, setAutoFocusToken] = useState(disabled ? 0 : 1);
    const [dropActive, setDropActive] = useState(false);
    // 仅在挂载时读一次草稿作种子；运行中由 onContentChange 写回 store，
    // 避免把 store 回灌成受控值导致 contenteditable 选区被重建。
    const [seedContent] = useState<JSONContent | null>(() =>
      initialContent !== undefined
        ? initialContent
        : useNotebookAiChats.getState().getComposerDraft(notebookId),
    );
    // 切回面板时草稿已在 DOM 水合前就决定发送按钮高亮，避免先暗后亮。
    const [isEmpty, setIsEmpty] = useState(
      () => !composerDraftHasContent(seedContent),
    );
    // 输入区超一行 → data-multiline 标记（高度由 --ai-composer-h 管）
    const [multiline, setMultiline] = useState(false);
    // chrome 两行展开：内容到模型选择器位置或有硬换行时，输入独占上行
    const [expanded, setExpanded] = useState(false);
    const shellRef = useRef<HTMLDivElement | null>(null);
    const plusWrapRef = useRef<HTMLSpanElement | null>(null);
    const modelWrapRef = useRef<HTMLSpanElement | null>(null);
    const sendWrapRef = useRef<HTMLSpanElement | null>(null);
    const expandedRef = useRef(false);

    const collapseChrome = useCallback(() => {
      if (!expandedRef.current) {
        setMultiline(false);
        return;
      }
      expandedRef.current = false;
      setExpanded(false);
      setMultiline(false);
    }, []);

    /**
     * 展开判断永远用「单行槽宽度」，不用展开后的全宽，避免
     * 「展开变宽 → 文字缩回一行 → 收起」来回振荡。
     * 空 payload 不等于单行：Shift+Enter 留下的空行也展开，单个占位 br 收回。
     */
    const recomputeExpanded = useCallback(() => {
      const shell = shellRef.current;
      const el = inputRef.current?.getEditorEl();
      if (!shell || !el) return;
      const content = measureNowrapContentSize(el, shell);
      const next = shouldExpandComposer({
        isEmpty: isEditorDomEmpty(el),
        contentWidth: content.width,
        slotWidth: measureSingleLineSlot({
          shell,
          plusWidth: plusWrapRef.current?.offsetWidth ?? 0,
          modelWidth: modelWrapRef.current?.offsetWidth ?? 0,
          sendWidth: sendWrapRef.current?.offsetWidth ?? 0,
        }),
        // 不读取受当前软换行/固定高度影响的 live scrollHeight。
        scrollHeight: content.height,
      });
      if (expandedRef.current !== next) {
        expandedRef.current = next;
        setExpanded(next);
      }
    }, []);

    // 侧栏拖宽、换模型名导致 chrome 变宽 → 重算
    useEffect(() => {
      const nodes = [
        shellRef.current,
        plusWrapRef.current,
        modelWrapRef.current,
        sendWrapRef.current,
      ].filter((node): node is HTMLElement => node != null);
      if (nodes.length === 0) return;
      const observer = new ResizeObserver(() => recomputeExpanded());
      for (const node of nodes) observer.observe(node);
      return () => observer.disconnect();
    }, [recomputeExpanded]);

    const cancelPendingDraftPersist = useCallback(() => {
      draftSeqRef.current += 1;
      if (draftTimerRef.current != null) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
    }, []);

    useEffect(() => {
      return () => {
        cancelPendingDraftPersist();
      };
    }, [cancelPendingDraftPersist]);

    const handleEscape = useCallback(() => {
      onEscape?.();
    }, [onEscape]);

    const handleContentChange = useCallback(
      (content: JSONContent | null) => {
        // 防抖写 Electron：英文快打也会打到同步 dbStorage；拼音中间态已在 input 层跳过
        const seq = ++draftSeqRef.current;
        if (draftTimerRef.current != null) {
          clearTimeout(draftTimerRef.current);
        }
        draftTimerRef.current = setTimeout(() => {
          draftTimerRef.current = null;
          if (seq !== draftSeqRef.current) return;
          useNotebookAiChats.getState().setComposerDraft(notebookId, content);
        }, COMPOSER_DRAFT_PERSIST_MS);
      },
      [notebookId],
    );

    const handleSubmit = useCallback(() => {
      if (disabled || isStreaming) return;
      const input = inputRef.current;
      const payload = input?.getPayload();
      if (!payload) return;

      const images = input?.resolveImages(payload) ?? [];
      const slashCommand = matchComposerPayloadSlashCommand(payload);
      if (slashCommand && images.length === 0) {
        input?.clear();
        cancelPendingDraftPersist();
        useNotebookAiChats.getState().clearComposerDraft(notebookId);
        setIsEmpty(true);
        collapseChrome();
        setAutoFocusToken((token) => token + 1);
        onSlashCommand?.(slashCommand);
        return;
      }

      if (isComposerPayloadEmpty(payload) && images.length === 0) return;

      const normalized = normalizeAiComposerPayload(payload);
      const accepted = onSend(normalized.payload, images);
      if (accepted === false) return;

      input?.clear();
      cancelPendingDraftPersist();
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      setIsEmpty(true);
      collapseChrome();
      setAutoFocusToken((token) => token + 1);
    }, [
      disabled,
      isStreaming,
      onSend,
      onSlashCommand,
      notebookId,
      cancelPendingDraftPersist,
      collapseChrome,
    ]);

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

    /** 粘贴图片 → 插入到光标处（Mac 截图常只有 items，files 为空） */
    const handleDockPaste = useCallback(
      (event: React.ClipboardEvent) => {
        if (disabled || isStreaming) return;
        const imageFiles = extractClipboardImageFiles(event.clipboardData);
        if (imageFiles.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        addImageFiles(imageFiles);
      },
      [addImageFiles, disabled, isStreaming],
    );

    /** 拖入图片：允许 drop + 轻量高亮 */
    const handleDockDragOver = useCallback(
      (event: React.DragEvent) => {
        if (disabled || isStreaming) return;
        const types = Array.from(event.dataTransfer?.types ?? []);
        if (
          !types.includes("Files") &&
          !types.some((t) => t.startsWith("image/"))
        ) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      },
      [disabled, isStreaming],
    );

    const handleDockDragLeave = useCallback((event: React.DragEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) return;
      setDropActive(false);
    }, []);

    const handleDockDrop = useCallback(
      (event: React.DragEvent) => {
        setDropActive(false);
        if (disabled || isStreaming) return;
        const imageFiles = extractClipboardImageFiles(event.dataTransfer);
        if (imageFiles.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        addImageFiles(imageFiles);
      },
      [addImageFiles, disabled, isStreaming],
    );

    useEffect(() => {
      let cancelled = false;
      const applyDetail = (detail: AppendComposerSelectionDetail) => {
        const attrs = buildSelectionQuoteAttrs({
          pageId: detail?.pageId ?? "",
          pageTitle: detail?.pageTitle ?? "",
          text: detail?.text ?? "",
        });
        if (!attrs) return true;
        const result = inputRef.current?.appendSelectionQuote(attrs, {
          animate: detail.animate === true,
        });
        if (result === "duplicate") {
          toast(SELECTION_QUOTE_DUPLICATE_TOAST);
          return true;
        }
        return result === "appended";
      };
      const flushPending = () => {
        const run = (tries: number) => {
          if (cancelled) return;
          const remaining = consumePendingAppendComposerSelections(applyDetail);
          if (remaining > 0 && tries > 0) {
            window.requestAnimationFrame(() => run(tries - 1));
          }
        };
        run(8);
      };
      window.addEventListener(APPEND_COMPOSER_SELECTION_EVENT, flushPending);
      flushPending();
      return () => {
        cancelled = true;
        window.removeEventListener(
          APPEND_COMPOSER_SELECTION_EVENT,
          flushPending,
        );
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
        },
        insertReference: (reference: AiFileReferenceAttrs) => {
          inputRef.current?.insertReference(reference);
        },
        replaceDefaultPageReference: (reference: AiFileReferenceAttrs) =>
          inputRef.current?.replaceDefaultPageReference(reference) ?? "skipped",
        appendSelectionQuote: (quote, options) =>
          inputRef.current?.appendSelectionQuote(quote, options) ?? "skipped",
      }),
      [],
    );

    // isEmpty 在 IME 会话里会滞后；发送按钮不因 isEmpty 禁用，避免「有字点不了」
    // 真正空内容由 handleSubmit 读 DOM 拦截。
    const canClickSend = !isStreaming && !disabled;
    const sendLooksReady = canClickSend && !isEmpty;

    return (
      <ComposerPrimitive.Root
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className={cn(
          "pointer-events-none",
          isFullscreen ? "px-6 pb-5" : "px-0 pb-2",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto w-full",
            isFullscreen ? "max-w-[720px]" : "max-w-none",
          )}
        >
          <PromptBar
            streaming={isStreaming}
            expanded={expanded}
            className={cn(
              expanded ? "rounded-[20px]" : "rounded-full",
              "shadow-[0_8px_22px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.32)]",
            )}
          >
            <div
              ref={shellRef}
              className={cn(
                "notebook-ai-composer-shell bui-root flex min-h-[44px] gap-2 overflow-hidden",
                expanded
                  ? "flex-wrap items-end rounded-[20px]"
                  : "flex-nowrap items-center rounded-full",
                "bg-[hsl(var(--goose-editor-bg))] py-1.5 pl-2.5 pr-2",
                dropActive &&
                  "ring-2 ring-[var(--goose-interactive-selected)] ring-offset-1 ring-offset-background",
              )}
              data-expanded={expanded ? "true" : undefined}
              data-multiline={multiline ? "true" : "false"}
              data-drop-active={dropActive ? "true" : undefined}
              onPaste={handleDockPaste}
              onDragEnter={handleDockDragOver}
              onDragOver={handleDockDragOver}
              onDragLeave={handleDockDragLeave}
              onDrop={handleDockDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={handleImageInput}
                disabled={disabled || isStreaming}
              />
              <span ref={plusWrapRef} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isStreaming}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    "text-muted-foreground transition-colors duration-150",
                    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                    isStreaming && "invisible pointer-events-none",
                  )}
                  aria-hidden={isStreaming}
                  tabIndex={isStreaming ? -1 : undefined}
                  aria-label="上传图片"
                  title="上传图片"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </span>

              {/* 始终挂在同一父级，只切 order/basis，不条件换位置（会丢 contenteditable 节点） */}
              <AiComposerInput
                ref={inputRef}
                placeholder={placeholder}
                autoFocusToken={autoFocusToken}
                initialContent={seedContent}
                onContentChange={handleContentChange}
                onSubmit={handleSubmit}
                onEscape={handleEscape}
                onIsEmptyChange={(empty) => {
                  setIsEmpty(empty);
                  if (empty) recomputeExpanded();
                }}
                onMultilineChange={setMultiline}
                onLayoutMeasure={recomputeExpanded}
                className={
                  expanded ? "order-first w-full basis-full" : "flex-1"
                }
                searchPages={searchPages}
                referencePlacement="inline"
                variant="panel"
                notebookId={notebookId}
                disabled={disabled || isStreaming}
                maxImageBytes={MAX_IMAGE_FILE_BYTES}
                maxImageCount={MAX_IMAGE_ATTACHMENTS}
                onImageRejected={(message) => toast.error(message)}
                onSlashCommand={onSlashCommand}
              />

              <span ref={modelWrapRef} className="flex shrink-0 items-center">
                <ModelSelectorPopover disabled={disabled} />
              </span>

              {/* 仅 spacer：两行时把发送按钮顶到最右，不是输入 */}
              {expanded ? (
                <div className="min-w-0 flex-1" aria-hidden />
              ) : null}

              <span ref={sendWrapRef} className="flex shrink-0 items-center">
                {isStreaming ? (
                  <ComposerPrimitive.Cancel
                    className="bui-composer-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#171717] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-[#f4f4f5] dark:text-[#171717]"
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <LoadingState
                      variant="Dots"
                      compact
                      label=""
                      showElapsed={false}
                    />
                  </ComposerPrimitive.Cancel>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canClickSend}
                    className={cn(
                      "bui-composer-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#171717] text-white dark:bg-[#f4f4f5] dark:text-[#171717]",
                      !sendLooksReady && "cursor-not-allowed opacity-35",
                    )}
                    aria-label="发送消息"
                    title="发送消息"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                )}
              </span>
            </div>
          </PromptBar>
        </div>
      </ComposerPrimitive.Root>
    );
  },
);

Composer.displayName = "Composer";
