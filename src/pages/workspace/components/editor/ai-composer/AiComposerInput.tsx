import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  serializeAiComposerDoc,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
} from "./referenceLookup";
import type { JSONContent } from "@/types";

const EMPTY_AI_COMPOSER_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function createComposerContent(value: string): JSONContent | null {
  if (!value.trim()) return null;
  return {
    type: "doc",
    content: value.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

function getComposerText(content: JSONContent | null | undefined): string {
  return serializeAiComposerDoc(content ?? EMPTY_AI_COMPOSER_CONTENT).promptText;
}

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
      variant = "compact",
      compactWidthClass,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [value, setValue] = useState(() => getComposerText(initialContent));
    const isEmpty = value.trim().length === 0;

    const syncValue = (nextValue: string) => {
      setValue(nextValue);
      onIsEmptyChange?.(nextValue.trim().length === 0);
      onContentChange?.(createComposerContent(nextValue));
    };

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
          const length = inputRef.current?.value.length ?? 0;
          inputRef.current?.setSelectionRange(length, length);
        },
        clear: () => {
          syncValue("");
        },
        getPayload: () => serializeAiComposerDoc(createComposerContent(value)),
      }),
      [value],
    );

    useEffect(() => {
      const nextValue = getComposerText(initialContent);
      setValue(nextValue);
      onIsEmptyChange?.(nextValue.trim().length === 0);
    }, [initialContent, onIsEmptyChange]);

    useEffect(() => {
      if (autoFocusToken > 0) {
        inputRef.current?.focus();
      }
    }, [autoFocusToken]);

    return (
      <div
        className={cn(
          "relative min-w-0 flex-1",
          variant === "panel" ? "w-full px-0" : compactWidthClass,
        )}
      >
        {placeholderOverlayText && isEmpty ? (
          <div
            className={cn(
              "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground/60",
              variant === "panel"
                ? "top-0 line-clamp-3 pr-10 text-[13px] leading-6"
                : "top-0 pr-8 text-[12px] leading-[20px]",
            )}
          >
            {placeholderOverlayText}
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          aria-label="AI 输入"
          data-ai-composer-editor="true"
          data-ai-composer-variant={variant}
          value={value}
          placeholder={placeholderOverlayText ? "" : placeholder}
          rows={variant === "panel" ? 3 : 1}
          className={cn(
            "block w-full resize-none overflow-y-auto bg-transparent p-0 text-foreground outline-none placeholder:text-muted-foreground/60",
            variant === "panel"
              ? "min-h-[56px] max-h-[144px] text-[13px] leading-6"
              : "min-h-[20px] max-h-[88px] text-[12px] leading-[20px]",
          )}
          onChange={(event) => syncValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onEscape();
            }
          }}
        />
      </div>
    );
  },
);

AiComposerInput.displayName = "AiComposerInput";
