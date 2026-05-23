import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  getAiReferenceSuggestionItems,
  type AiComposerPayload,
  type AiComposerToken,
  type AiFileReferenceAttrs,
  type AiReferenceSuggestionItem,
} from "./referenceLookup";
import { AiComposerMentionPopover } from "./AiComposerMentionPopover";
import { useTabs } from "@/stores/useTabs";
import type { JSONContent } from "@/types";

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
          const attrs = JSON.parse(el.dataset.aiMentionAttrs) as AiFileReferenceAttrs;
          tokens.push({ type: "reference", reference: attrs });
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
  let promptText = "";
  let freeformText = "";

  for (const token of tokens) {
    if (token.type === "text") {
      promptText += token.text;
      freeformText += token.text;
    } else {
      references.push(token.reference);
      promptText += `@${token.reference.titleSnapshot}`;
    }
  }

  return {
    promptText: promptText.trim(),
    freeformText: freeformText.trim(),
    references,
    tokens,
  };
}

function buildJsonContentFromTokens(tokens: AiComposerToken[]): JSONContent | null {
  if (!tokens.length) return null;

  const paragraphs: AiComposerToken[][] = [[]];

  for (const token of tokens) {
    if (token.type === "text") {
      const parts = token.text.split("\n");
      if (parts[0]) paragraphs[paragraphs.length - 1].push({ type: "text", text: parts[0] });
      for (let i = 1; i < parts.length; i++) {
        paragraphs.push([]);
        if (parts[i]) paragraphs[paragraphs.length - 1].push({ type: "text", text: parts[i] });
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
          : { type: "aiFileReference", attrs: token.reference },
      ),
    })),
  };
}

function createChipElement(attrs: AiFileReferenceAttrs): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.aiMentionId = attrs.pageId;
  span.dataset.aiMentionAttrs = JSON.stringify(attrs);
  span.className =
    "inline-flex items-center mx-1 rounded px-1 py-0 text-[11px] font-medium" +
    " bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30" +
    " cursor-pointer hover:bg-sky-500/20 select-none align-middle leading-5";
  span.textContent = `@${attrs.titleSnapshot}`;
  return span;
}

function setDomFromJsonContent(
  container: HTMLElement,
  content: JSONContent | null | undefined,
) {
  container.innerHTML = "";
  if (!content?.content?.length) return;

  content.content.forEach((block: any, blockIdx: number) => {
    if (blockIdx > 0) container.appendChild(document.createElement("br"));
    (block.content ?? []).forEach((node: any) => {
      if (node.type === "text") {
        container.appendChild(document.createTextNode(node.text ?? ""));
      } else if (node.type === "aiFileReference" && node.attrs) {
        container.appendChild(createChipElement(node.attrs as AiFileReferenceAttrs));
      }
    });
  });
}

// ─── Mention detection ───────────────────────────────────────────────────────

interface DetectedMention {
  query: string;
  range: Range;
}

function detectMentionAtCaret(container: HTMLElement): DetectedMention | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return null;

  const anchor = selection.anchorNode;
  if (!anchor || anchor.nodeType !== Node.TEXT_NODE) return null;
  if (!container.contains(anchor)) return null;

  const text = anchor.textContent ?? "";
  const offset = selection.anchorOffset;
  const beforeCaret = text.slice(0, offset);

  const atIndex = beforeCaret.lastIndexOf("@");
  if (atIndex === -1) return null;

  if (atIndex > 0 && !/[\s\n]/.test(beforeCaret[atIndex - 1])) return null;

  const query = beforeCaret.slice(atIndex + 1);
  if (/[\s\n]/.test(query)) return null;

  const range = document.createRange();
  range.setStart(anchor, atIndex);
  range.setEnd(anchor, offset);

  return { query, range };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AiComposerInputHandle {
  focus: () => void;
  clear: () => void;
  getPayload: () => AiComposerPayload;
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
  variant?: "compact" | "panel";
  compactWidthClass?: string;
}

interface MentionState {
  active: boolean;
  query: string;
  anchorRect: DOMRect | null;
  activeIndex: number;
}

const INACTIVE_MENTION: MentionState = {
  active: false,
  query: "",
  anchorRect: null,
  activeIndex: 0,
};

export const AiComposerInput = forwardRef<AiComposerInputHandle, AiComposerInputProps>(
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
      variant = "compact",
      compactWidthClass,
    },
    ref,
  ) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const isComposingRef = useRef(false);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastDetectedRef = useRef<DetectedMention | null>(null);
    // Track the most recent content we emitted upward so we can ignore the echo
    // back via `initialContent` — otherwise the sync useEffect rebuilds the DOM
    // on every keystroke, invalidating the live selection and any cached ranges.
    const lastEmittedContentRef = useRef<JSONContent | null | undefined>(initialContent);

    const [isEmpty, setIsEmpty] = useState(true);
    const [mention, setMention] = useState<MentionState>(INACTIVE_MENTION);

    const mentionItems = mention.active
      ? getAiReferenceSuggestionItems(mention.query, { includeFolders: false })
      : [];

    // Keep a ref so keyboard handler always sees current items without stale closure
    const mentionItemsRef = useRef(mentionItems);
    mentionItemsRef.current = mentionItems;

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
          lastDetectedRef.current = null;
          lastEmittedContentRef.current = null;
          setIsEmpty(true);
          setMention(INACTIVE_MENTION);
          onIsEmptyChange?.(true);
          onContentChange?.(null);
        },
        getPayload: (): AiComposerPayload => {
          const el = editorRef.current;
          if (!el) return { promptText: "", freeformText: "", references: [], tokens: [] };
          return buildPayloadFromTokens(readTokensFromDom(el));
        },
      }),
      [onIsEmptyChange, onContentChange],
    );

    // ── sync initialContent → DOM ────────────────────────────────────────────

    useEffect(() => {
      // Skip the echo of our own emission — the DOM is already up to date and
      // rebuilding it would wipe the live text node our cached range points at.
      if (initialContent === lastEmittedContentRef.current) return;
      lastEmittedContentRef.current = initialContent;
      const el = editorRef.current;
      if (!el) return;
      setDomFromJsonContent(el, initialContent);
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
      const el = editorRef.current;
      if (!el) return;

      const tokens = readTokensFromDom(el);
      const payload = buildPayloadFromTokens(tokens);
      const empty = payload.promptText.length === 0;
      setIsEmpty(empty);
      onIsEmptyChange?.(empty);
      const nextContent = buildJsonContentFromTokens(tokens);
      lastEmittedContentRef.current = nextContent;
      onContentChange?.(nextContent);

      if (isComposingRef.current) return;

      const detected = detectMentionAtCaret(el);
      if (detected) {
        lastDetectedRef.current = detected;
        const rect = detected.range.getBoundingClientRect();
        setMention((prev) => ({
          active: true,
          query: detected.query,
          anchorRect: rect,
          activeIndex: detected.query !== prev.query ? 0 : prev.activeIndex,
        }));
      } else {
        lastDetectedRef.current = null;
        setMention((prev) => (prev.active ? INACTIVE_MENTION : prev));
      }
    }, [onIsEmptyChange, onContentChange]);

    // ── chip insertion ───────────────────────────────────────────────────────

    const insertMention = useCallback(
      (item: AiReferenceSuggestionItem) => {
        const el = editorRef.current;
        if (!el) return;

        setMention(INACTIVE_MENTION);

        // Prefer the range captured at detection time — by the time we get here,
        // React may have re-rendered (popover mounting) and Chromium can reset the
        // live selection's anchor to the contenteditable container, which would
        // make a fresh detectMentionAtCaret() return null.
        const detected = lastDetectedRef.current ?? detectMentionAtCaret(el);
        lastDetectedRef.current = null;
        if (!detected) return;

        const chip = createChipElement(item);
        const spacer = document.createTextNode(" ");
        try {
          detected.range.deleteContents();
          // Insert chip + spacer as one fragment so range state after insertNode
          // doesn't affect spacer placement.
          const frag = document.createDocumentFragment();
          frag.appendChild(chip);
          frag.appendChild(spacer);
          detected.range.insertNode(frag);
        } catch {
          return;
        }

        // Focus BEFORE placing the cursor — calling focus() after addRange()
        // resets the selection in some browsers.
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const r = document.createRange();
          r.setStart(spacer, spacer.length);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }

        const tokens = readTokensFromDom(el);
        const payload = buildPayloadFromTokens(tokens);
        const empty = payload.promptText.length === 0;
        setIsEmpty(empty);
        onIsEmptyChange?.(empty);
        const nextContent = buildJsonContentFromTokens(tokens);
        lastEmittedContentRef.current = nextContent;
        onContentChange?.(nextContent);
        onReferenceAdded?.(item);
      },
      [onIsEmptyChange, onContentChange, onReferenceAdded],
    );

    // ── keyboard handler ─────────────────────────────────────────────────────

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.nativeEvent.isComposing) return;

        if (mention.active) {
          const items = mentionItemsRef.current;
          const count = Math.max(1, items.length);

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setMention((prev) => ({ ...prev, activeIndex: (prev.activeIndex + 1) % count }));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setMention((prev) => ({
              ...prev,
              activeIndex: (prev.activeIndex - 1 + count) % count,
            }));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const item = items[mention.activeIndex];
            if (item) {
              insertMention(item);
            }
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setMention(INACTIVE_MENTION);
            return;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
          return;
        }

        if (event.key === "Enter" && event.shiftKey) {
          event.preventDefault();
          const sel = window.getSelection();
          if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement("br");
            range.insertNode(br);
            range.setStartAfter(br);
            range.setEndAfter(br);
            sel.removeAllRanges();
            sel.addRange(range);
            // trigger input to update empty state
            handleInput();
          }
        }
      },
      [mention.active, mention.activeIndex, insertMention, onSubmit, onEscape, handleInput],
    );

    // ── chip click delegation ────────────────────────────────────────────────

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const mentionId = target.dataset.aiMentionId;
      if (mentionId) {
        e.preventDefault();
        useTabs.getState().openTab(mentionId);
      }
    }, []);

    // ── blur: close popover with delay (allows popover click to fire first) ──

    const handleBlur = useCallback(() => {
      blurTimerRef.current = setTimeout(() => {
        setMention(INACTIVE_MENTION);
      }, 150);
    }, []);

    const cancelBlurTimer = useCallback(() => {
      if (blurTimerRef.current !== null) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    }, []);

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
              "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground/60",
              variant === "panel"
                ? "top-0 line-clamp-3 pr-10 text-[13px] leading-6"
                : "top-0 pr-8 text-[12px] leading-[20px]",
            )}
          >
            {placeholderOverlayText ?? placeholder}
          </div>
        ) : null}

        {/* eslint-disable-next-line jsx-a11y/aria-role */}
        <div
          ref={editorRef}
          role="textbox"
          aria-label="AI 输入"
          aria-multiline="true"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          contentEditable
          suppressContentEditableWarning
          data-ai-composer-editor="true"
          data-ai-composer-variant={variant}
          className={cn(
            "block w-full bg-transparent p-0 text-foreground outline-none",
            "overflow-y-auto break-words whitespace-pre-wrap",
            variant === "panel"
              ? "min-h-[56px] max-h-[144px] text-[13px] leading-6"
              : "min-h-[20px] max-h-[88px] text-[12px] leading-[20px]",
          )}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onBlur={handleBlur}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            handleInput();
          }}
        />

        {mention.active && mention.anchorRect ? (
          <AiComposerMentionPopover
            items={mentionItems}
            activeIndex={mention.activeIndex}
            anchorRect={mention.anchorRect}
            onSelect={insertMention}
            onMouseDownCapture={cancelBlurTimer}
          />
        ) : null}
      </div>
    );
  },
);

AiComposerInput.displayName = "AiComposerInput";
