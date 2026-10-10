/** AI 输入框 React 空壳；命令式编辑器与输入流程由 controller 组装。 */
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ComposerSuggestionsList } from "./ComposerSuggestionsList";
import { SkillSuggestionsList } from "./SkillSuggestionsList";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";
import type {
  AiComposerInputHandle,
  AiComposerInputProps,
} from "./composerInputTypes";
import { useAiComposerController } from "./useAiComposerController";

export {
  COMPOSER_CHIP_DELETE_FLUSH_MS,
  COMPOSER_DELETE_FLUSH_MS,
  COMPOSER_INPUT_FLUSH_MS,
  isComposerDeleteInputType,
  shouldProcessComposerInput,
} from "./composerInputGuards";
export {
  COMPOSER_CHIP_SELECTOR,
  editorHasComposerChips,
  getComposerChipAfterCaret,
  getComposerChipBeforeCaret,
  isComposerChipElement,
  rangeContainsComposerChip,
  resolveComposerBeforeInputDelete,
  selectionCoversEntireEditor,
  type ComposerBeforeInputDeleteAction,
} from "./composerChipDom";
export type {
  ComposerImageEntry,
  ComposerImageRegistry,
} from "./composerImageChip";
export type { AiComposerInputHandle } from "./composerInputTypes";

export const AiComposerInput = forwardRef<
  AiComposerInputHandle,
  AiComposerInputProps
>((props, ref) => {
  const {
    placeholder,
    placeholderOverlayText,
    className,
    variant = "compact",
    compactWidthClass,
  } = props;
  const {
    editorHostRef,
    placeholderRef,
    liveRegionRef,
    isEmpty,
    mention,
    mentionItems,
    insertMention,
    cancelMentionBlurTimer,
    command,
    commandItems,
    insertCommand,
    imagePreviewContent,
    setImagePreviewContent,
  } = useAiComposerController(props, ref);
  return (
    <div
      className={cn(
        "relative min-w-0",
        className ?? "flex-1",
        variant === "panel" ? "w-full px-0" : compactWidthClass,
      )}
    >
      {placeholderOverlayText || placeholder ? (
        <div
          ref={placeholderRef}
          className={cn(
            "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground",
            variant === "panel"
              ? "top-0 overflow-hidden text-ellipsis whitespace-nowrap font-[family-name:var(--font-default)] text-[length:var(--editor-font-size)] leading-[var(--editor-line-height)]"
              : "top-0 pr-8 text-[12px] leading-[20px]",
          )}
          style={isEmpty ? undefined : { display: "none" }}
        >
          {placeholderOverlayText ?? placeholder}
        </div>
      ) : null}

      {/* 空壳：真正 contenteditable 在 useLayoutEffect 里 append，React 永不 reconcile 它 */}
      <div ref={editorHostRef} className="relative min-w-0" />
      <span
        ref={liveRegionRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-ai-composer-live=""
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

      <FullscreenPreview
        open={Boolean(imagePreviewContent)}
        content={imagePreviewContent}
        title={imagePreviewContent?.fileName}
        onClose={() => setImagePreviewContent(null)}
      />
    </div>
  );
});

AiComposerInput.displayName = "AiComposerInput";
