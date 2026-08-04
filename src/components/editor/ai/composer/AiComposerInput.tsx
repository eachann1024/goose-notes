import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AiComposerPayload,
  type AiComposerToken,
  type AiFileReferenceAttrs,
  type AiImageAttachmentAttrs,
  type AiReferenceSuggestionItem,
} from "./referenceLookup";
import { ComposerSuggestionsList } from "@/components/editor/ai/composer/ComposerSuggestionsList";
import {
  createChipElement,
  useReferenceMentions,
} from "./useReferenceMentions";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useSettings } from "@/stores/useSettings";
import { useSkillCommands } from "./useSkillCommands";
import { SkillSuggestionsList } from "./SkillSuggestionsList";
import type { JSONContent } from "@/types";
import {
  calculateImageSha256,
  ImageDedupTracker,
} from "./imageDedup";

// ─── Image registry ─────────────────────────────────────────────────────────

/**
 * 内联图片的实体：chip 只携带可序列化 attrs，
 * 真实 File / previewUrl 由每个 composer 实例的注册表维护。
 */
export interface ComposerImageEntry {
  file: File;
  previewUrl: string;
}

export type ComposerImageRegistry = Map<string, ComposerImageEntry>;

function createImageChipElement(
  attrs: AiImageAttachmentAttrs,
  registry: ComposerImageRegistry,
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.aiImageAttrs = JSON.stringify(attrs);
  // 与 mention chip 共用 .ai-composer-chip：inline-flex + items-center 垂直居中。
  span.className =
    "ai-composer-chip inline-flex items-center justify-center gap-1 mx-1 rounded px-1 text-[11px] font-medium leading-none" +
    " bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] border border-border" +
    " select-none";

  const entry = registry.get(attrs.imageId);
  if (entry) {
    const img = document.createElement("img");
    img.src = entry.previewUrl;
    img.alt = "";
    img.className = "ai-composer-chip-thumb h-3.5 w-3.5 shrink-0 rounded-[3px] object-cover";
    span.appendChild(img);
  }

  const label = document.createElement("span");
  label.className = "max-w-[140px] truncate leading-none";
  label.textContent = attrs.fileName;
  span.appendChild(label);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.dataset.aiImageRemove = attrs.imageId;
  removeBtn.setAttribute("aria-label", `移除图片 ${attrs.fileName}`);
  removeBtn.title = `移除 ${attrs.fileName}`;
  removeBtn.className =
    "ai-composer-chip-remove ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px]" +
    " text-muted-foreground hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-foreground";
  removeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  span.appendChild(removeBtn);

  return span;
}

function createImageId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `img-${globalThis.crypto.randomUUID()}`;
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

function readTokensFromDom(container: HTMLElement): AiComposerToken[] {
  const tokens: AiComposerToken[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) tokens.push({ type: "text", text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") {
        tokens.push({ type: "text", text: "\n" });
      } else if (el.dataset.aiMentionAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiMentionAttrs,
          ) as AiFileReferenceAttrs;
          tokens.push({ type: "reference", reference: attrs });
        } catch {
          // ignore malformed chip
        }
      } else if (el.dataset.aiImageAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiImageAttrs,
          ) as AiImageAttachmentAttrs;
          tokens.push({ type: "image", image: attrs });
        } catch {
          // ignore malformed chip
        }
      } else {
        el.childNodes.forEach(walk);
      }
    }
  }

  container.childNodes.forEach(walk);
  return tokens;
}

function buildPayloadFromTokens(tokens: AiComposerToken[]): AiComposerPayload {
  const references: AiFileReferenceAttrs[] = [];
  const images: AiImageAttachmentAttrs[] = [];
  let promptText = "";
  let freeformText = "";

  for (const token of tokens) {
    if (token.type === "text") {
      promptText += token.text;
      freeformText += token.text;
    } else if (token.type === "reference") {
      references.push(token.reference);
      promptText += `@${token.reference.titleSnapshot}`;
    } else {
      images.push(token.image);
      promptText += `[图片 ${token.image.fileName}]`;
    }
  }

  return {
    promptText: promptText.trim(),
    freeformText: freeformText.trim(),
    references,
    images,
    tokens,
  };
}

function buildJsonContentFromTokens(
  tokens: AiComposerToken[],
): JSONContent | null {
  if (!tokens.length) return null;

  const paragraphs: AiComposerToken[][] = [[]];

  for (const token of tokens) {
    if (token.type === "text") {
      const parts = token.text.split("\n");
      if (parts[0])
        paragraphs[paragraphs.length - 1].push({
          type: "text",
          text: parts[0],
        });
      for (let i = 1; i < parts.length; i++) {
        paragraphs.push([]);
        if (parts[i])
          paragraphs[paragraphs.length - 1].push({
            type: "text",
            text: parts[i],
          });
      }
    } else {
      paragraphs[paragraphs.length - 1].push(token);
    }
  }

  if (!paragraphs.some((p) => p.length > 0)) return null;

  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: line.map((token) =>
        token.type === "text"
          ? { type: "text", text: token.text }
          : token.type === "reference"
            ? { type: "aiFileReference", attrs: token.reference }
            : { type: "aiImageAttachment", attrs: token.image },
      ),
    })),
  };
}

function setDomFromJsonContent(
  container: HTMLElement,
  content: JSONContent | null | undefined,
  registry: ComposerImageRegistry,
) {
  container.innerHTML = "";
  if (!content?.content?.length) return;

  content.content.forEach((block: any, blockIdx: number) => {
    if (blockIdx > 0) container.appendChild(document.createElement("br"));
    (block.content ?? []).forEach((node: any) => {
      if (node.type === "text") {
        container.appendChild(document.createTextNode(node.text ?? ""));
      } else if (node.type === "aiFileReference" && node.attrs) {
        container.appendChild(
          createChipElement(node.attrs as AiFileReferenceAttrs),
        );
      } else if (node.type === "aiImageAttachment" && node.attrs) {
        container.appendChild(
          createImageChipElement(
            node.attrs as AiImageAttachmentAttrs,
            registry,
          ),
        );
      }
    });
  });
}

/**
 * Insert a soft line break into the contenteditable composer.
 * Prefer native insertLineBreak / insertText; fall back to a trailing-safe <br>.
 * A lone trailing <br> often fails to create a visible new line in Chromium.
 */
function insertComposerLineBreak(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const selectionInsideEditor =
    selection.rangeCount > 0 &&
    (editor === selection.anchorNode ||
      editor.contains(selection.anchorNode));

  if (!selectionInsideEditor) {
    editor.focus();
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(endRange);
  }

  try {
    if (document.execCommand("insertLineBreak")) return true;
  } catch {
    // fall through
  }

  // whitespace-pre-wrap makes a real newline text node render correctly
  try {
    if (document.execCommand("insertText", false, "\n")) return true;
  } catch {
    // fall through
  }

  if (!selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (
    editor !== range.commonAncestorContainer &&
    !editor.contains(range.commonAncestorContainer)
  ) {
    return false;
  }

  range.deleteContents();
  const br = document.createElement("br");
  range.insertNode(br);

  // Trailing <br> needs a following anchor node so the caret can sit on the new line
  if (!br.nextSibling) {
    const anchor = document.createElement("br");
    br.parentNode?.insertBefore(anchor, br.nextSibling);
  }

  const nextRange = document.createRange();
  nextRange.setStartAfter(br);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AiComposerInputHandle {
  focus: () => void;
  clear: () => void;
  getPayload: () => AiComposerPayload;
  /** 解析 payload 中的内联图片 token → 真实 File 附件，按出现顺序 */
  resolveImages: (payload: AiComposerPayload) => { file: File; previewUrl: string }[];
  /** 在光标处插入图片 chip（无光标时追加到末尾） */
  insertImages: (files: File[]) => void;
  /** 在光标处插入页面引用 chip（无光标时追加到末尾） */
  insertReference: (reference: AiFileReferenceAttrs) => void;
}

interface AiComposerInputProps {
  placeholder: string;
  placeholderOverlayText?: string;
  autoFocusToken: number;
  onSubmit: () => void;
  onEscape: () => void;
  initialContent?: JSONContent | null;
  onContentChange?: (content: JSONContent | null) => void;
  onIsEmptyChange?: (isEmpty: boolean) => void;
  onReferenceAdded?: (reference: AiFileReferenceAttrs) => void;
  searchPages?: (query: string) => AiReferenceSuggestionItem[];
  referencePlacement?: "inline" | "external";
  variant?: "compact" | "panel";
  compactWidthClass?: string;
  disabled?: boolean;
  /** 单张图片最大字节数，超出触发 onImageRejected */
  maxImageBytes?: number;
  /** 输入框内最多同时存在的图片数量，超出触发 onImageRejected */
  maxImageCount?: number;
  onImageRejected?: (message: string) => void;
}

export const AiComposerInput = forwardRef<
  AiComposerInputHandle,
  AiComposerInputProps
>(
  (
    {
      placeholder,
      placeholderOverlayText,
      autoFocusToken,
      onSubmit,
      onEscape,
      initialContent,
      onContentChange,
      onIsEmptyChange,
      onReferenceAdded,
      searchPages,
      referencePlacement = "inline",
      variant = "compact",
      compactWidthClass,
      disabled,
      maxImageBytes,
      maxImageCount,
      onImageRejected,
    },
    ref,
  ) => {
    const { onOpenPage } = useEditorPageContext();
    const readLocalSkills = useSettings((state) => state.ai.readLocalSkills);
    const editorRef = useRef<HTMLDivElement | null>(null);
    const isComposingRef = useRef(false);
    // Track the most recent content we emitted upward so we can ignore the echo
    // back via `initialContent` — otherwise the sync useEffect rebuilds the DOM
    // on every keystroke, invalidating the live selection and any cached ranges.
    const lastEmittedContentRef = useRef<JSONContent | null | undefined>(
      initialContent,
    );
    // imageId → { file, previewUrl }；chip 只携带可序列化 attrs
    const imageRegistryRef = useRef<ComposerImageRegistry>(new Map());
    const imageDedupRef = useRef(new ImageDedupTracker());

    const [isEmpty, setIsEmpty] = useState(true);

    const countImageTokens = useCallback((): number => {
      const el = editorRef.current;
      if (!el) return 0;
      return readTokensFromDom(el).filter((token) => token.type === "image")
        .length;
    }, []);

    const emitCurrentContent = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;

      const tokens = readTokensFromDom(el);
      // GC：用户用退格键删除 chip 时，同步释放注册表里不再存在的 entry
      const liveIds = new Set(
        tokens
          .filter((token) => token.type === "image")
          .map((token) => token.image.imageId),
      );
      imageRegistryRef.current.forEach((entry, imageId) => {
        if (!liveIds.has(imageId)) {
          URL.revokeObjectURL(entry.previewUrl);
          imageRegistryRef.current.delete(imageId);
          imageDedupRef.current.release(imageId);
        }
      });

      const payload = buildPayloadFromTokens(tokens);
      const empty = payload.promptText.length === 0;
      setIsEmpty(empty);
      onIsEmptyChange?.(empty);
      const nextContent = buildJsonContentFromTokens(tokens);
      lastEmittedContentRef.current = nextContent;
      onContentChange?.(nextContent);
    }, [onIsEmptyChange, onContentChange]);

    const {
      mention,
      mentionItems,
      detectMention,
      insertMention,
      handleMentionKeyDown,
      handleMentionBlur,
      cancelMentionBlurTimer,
      clearMentionState,
    } = useReferenceMentions({
      editorRef,
      isComposingRef,
      onContentMutation: emitCurrentContent,
      onReferenceAdded,
      searchPages,
      referencePlacement,
    });

    const {
      command,
      items: commandItems,
      detectCommand,
      insertCommand,
      handleCommandKeyDown,
      clearCommandState,
    } = useSkillCommands({
      editorRef,
      isComposingRef,
      enabled: readLocalSkills,
      onContentMutation: emitCurrentContent,
    });

    // ── image helpers ────────────────────────────────────────────────────────

    const releaseAllImages = useCallback(() => {
      imageRegistryRef.current.forEach((entry) =>
        URL.revokeObjectURL(entry.previewUrl),
      );
      imageRegistryRef.current.clear();
      imageDedupRef.current.clear();
    }, []);

    const removeImageChip = useCallback(
      (imageId: string) => {
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
          emitCurrentContent();
        }
      },
      [emitCurrentContent],
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

        const frag = document.createDocumentFragment();
        let lastSpacer: Text | null = null;
        for (const { file, attrs } of accepted) {
          imageRegistryRef.current.set(attrs.imageId, {
            file,
            previewUrl: URL.createObjectURL(file),
          });
          frag.appendChild(createImageChipElement(attrs, imageRegistryRef.current));
          lastSpacer = document.createTextNode(" ");
          frag.appendChild(lastSpacer);
        }
        range.insertNode(frag);

        if (lastSpacer) {
          const caretRange = document.createRange();
          caretRange.setStart(lastSpacer, lastSpacer.length);
          caretRange.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(caretRange);
        }

        emitCurrentContent();

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
        emitCurrentContent,
        maxImageBytes,
        maxImageCount,
        onImageRejected,
        removeImageChip,
      ],
    );

    const insertReference = useCallback(
      (reference: AiFileReferenceAttrs) => {
        const el = editorRef.current;
        if (!el) return;

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

        const spacer = document.createTextNode(" ");
        const frag = document.createDocumentFragment();
        frag.appendChild(createChipElement(reference));
        frag.appendChild(spacer);
        range.insertNode(frag);

        const caretRange = document.createRange();
        caretRange.setStart(spacer, spacer.length);
        caretRange.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(caretRange);

        emitCurrentContent();
      },
      [emitCurrentContent],
    );

    // ── imperative handle ────────────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          const el = editorRef.current;
          if (!el) return;
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        },
        clear: () => {
          const el = editorRef.current;
          if (!el) return;
          el.innerHTML = "";
          lastEmittedContentRef.current = null;
          releaseAllImages();
          setIsEmpty(true);
          clearMentionState();
          clearCommandState();
          onIsEmptyChange?.(true);
          onContentChange?.(null);
        },
        getPayload: (): AiComposerPayload => {
          const el = editorRef.current;
          if (!el)
            return {
              promptText: "",
              freeformText: "",
              references: [],
              images: [],
              tokens: [],
            };
          return buildPayloadFromTokens(readTokensFromDom(el));
        },
        resolveImages: (payload: AiComposerPayload) =>
          payload.images
            .map((attrs) => {
              const entry = imageRegistryRef.current.get(attrs.imageId);
              return entry ? { file: entry.file, previewUrl: entry.previewUrl } : null;
            })
            .filter(
              (item): item is { file: File; previewUrl: string } => item !== null,
            ),
        insertImages,
        insertReference,
      }),
      [
        clearMentionState,
        clearCommandState,
        onIsEmptyChange,
        onContentChange,
        releaseAllImages,
        insertImages,
        insertReference,
      ],
    );

    // ── unmount: release object URLs ─────────────────────────────────────────

    useEffect(() => {
      const registry = imageRegistryRef.current;
      const dedup = imageDedupRef.current;
      return () => {
        registry.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        registry.clear();
        dedup.clear();
      };
    }, []);

    // ── sync initialContent → DOM ────────────────────────────────────────────

    useEffect(() => {
      // Skip the echo of our own emission — the DOM is already up to date and
      // rebuilding it would wipe the live text node our cached range points at.
      if (initialContent === lastEmittedContentRef.current) return;
      lastEmittedContentRef.current = initialContent;
      const el = editorRef.current;
      if (!el) return;
      setDomFromJsonContent(el, initialContent, imageRegistryRef.current);
      const tokens = readTokensFromDom(el);
      const empty = buildPayloadFromTokens(tokens).promptText.length === 0;
      setIsEmpty(empty);
      onIsEmptyChange?.(empty);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContent]);

    // ── auto-focus ───────────────────────────────────────────────────────────

    useEffect(() => {
      if (autoFocusToken > 0) editorRef.current?.focus();
    }, [autoFocusToken]);

    // ── input handler ────────────────────────────────────────────────────────

    const handleInput = useCallback(() => {
      emitCurrentContent();
      detectMention();
      detectCommand();
    }, [emitCurrentContent, detectMention, detectCommand]);

    // ── keyboard handler ─────────────────────────────────────────────────────

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.nativeEvent.isComposing || isComposingRef.current) return;

        if (handleMentionKeyDown(event)) return;
        if (handleCommandKeyDown(event)) return;

        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
          return;
        }

        if (event.key !== "Enter") return;

        // Shift+Enter：软换行（多行输入）
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          const el = editorRef.current;
          if (!el) return;
          if (insertComposerLineBreak(el)) {
            handleInput();
          }
          return;
        }

        // Enter / ⌘·Ctrl+Enter：发送
        event.preventDefault();
        onSubmit();
      },
      [handleMentionKeyDown, handleCommandKeyDown, onSubmit, onEscape, handleInput],
    );

    // ── chip click delegation ────────────────────────────────────────────────

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;

        // 图片 chip 内的 × 删除按钮（target 可能是 svg/path）
        const removeBtn = target.closest<HTMLElement>("[data-ai-image-remove]");
        if (removeBtn) {
          e.preventDefault();
          removeImageChip(removeBtn.dataset.aiImageRemove!);
          return;
        }

        const mentionChip = target.closest<HTMLElement>("[data-ai-mention-id]");
        const mentionId = mentionChip?.dataset.aiMentionId;
        if (mentionId) {
          e.preventDefault();
          onOpenPage(mentionId);
        }
      },
      [onOpenPage, removeImageChip],
    );

    return (
      <div
        className={cn(
          "relative min-w-0 flex-1",
          variant === "panel" ? "w-full px-0" : compactWidthClass,
        )}
      >
        {(placeholderOverlayText || placeholder) && isEmpty ? (
          <div
            className={cn(
              "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground opacity-70",
              variant === "panel"
                ? "top-0 line-clamp-3 text-[13px] leading-6"
                : "top-0 pr-8 text-[12px] leading-[20px]",
            )}
          >
            {placeholderOverlayText ?? placeholder}
          </div>
        ) : null}

        <div
          ref={editorRef}
          role="textbox"
          aria-label="AI 输入"
          aria-multiline="true"
          aria-disabled={disabled ? "true" : undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-ai-composer-editor="true"
          data-ai-composer-variant={variant}
          className={cn(
            "block w-full bg-transparent p-0 text-foreground outline-none",
            "overflow-y-auto break-words whitespace-pre-wrap",
            disabled && "cursor-not-allowed opacity-60",
            variant === "panel"
              ? "min-h-[24px] max-h-[144px] text-[13px] leading-6"
              : "min-h-[20px] max-h-[88px] text-[12px] leading-[20px]",
          )}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onBlur={() => {
            handleMentionBlur();
            clearCommandState();
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            handleInput();
          }}
        />

        {mention.active && mention.anchorRect ? (
          <ComposerSuggestionsList
            items={mentionItems}
            activeIndex={mention.activeIndex}
            listKey={mention.query}
            anchorRect={mention.anchorRect}
            onSelect={insertMention}
            onMouseDownCapture={cancelMentionBlurTimer}
          />
        ) : null}

        {command.active && command.anchorRect ? (
          <SkillSuggestionsList
            items={commandItems}
            activeIndex={command.activeIndex}
            listKey={command.query}
            anchorRect={command.anchorRect}
            onSelect={insertCommand}
          />
        ) : null}
      </div>
    );
  },
);

AiComposerInput.displayName = "AiComposerInput";
